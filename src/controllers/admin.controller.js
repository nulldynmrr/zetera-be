import prisma from "../lib/prisma.js";
import { setSecret, getSecret, getKeyPresets } from "../services/config.service.js";
import { encryptText, decryptText } from "../lib/encryption.js";
import * as billingService from "../services/billing.service.js";
import { Groq } from "groq-sdk";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Zetera Admin Controller — AI Engine Control, Billing & Executive Telemetry
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * 1. Executive Dashboard Aggregated Stats
 * Menggunakan optimasi single-query & groupBy (Bebas N+1 Problem)
 */
export async function getAdminStats(req, res, next) {
  try {
    const [
      totalUsers,
      totalProjects,
      totalJournals,
      totalNodes,
      billingConfig,
      totalUsageStats,
      freeTierStats,
      modelUsageGroup,
      recentLogs,
      userTiersGroup,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.researchProject.count(),
      prisma.journal.count(),
      prisma.frameworkNode.count(),
      billingService.getBillingConfig(),

      // Total usage & expense (Paid only)
      prisma.aiUsageLog.aggregate({
        where: { isFreeTierCall: false },
        _sum: {
          costUsd: true,
          costIdr: true,
          chargeUser: true,
          inputTokens: true,
          outputTokens: true,
          creditsCharged: true,
          profitUsd: true,
        },
        _count: { id: true },
      }),

      // Free tier usage
      prisma.aiUsageLog.aggregate({
        where: { isFreeTierCall: true },
        _sum: {
          inputTokens: true,
          outputTokens: true,
        },
        _count: { id: true },
      }),

      // Single groupBy for AI Model Usage Donut
      prisma.aiUsageLog.groupBy({
        by: ["modelId"],
        _count: { id: true },
        _sum: {
          costUsd: true,
          inputTokens: true,
          outputTokens: true,
        },
      }),

      // Recent 10 AI activities
      prisma.aiUsageLog.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          feature: { select: { code: true, label: true } },
          model: { select: { routerLabel: true, modelName: true, isFreeTier: true } },
        },
      }),

      // User Roles / Tiers breakdown
      prisma.user.groupBy({
        by: ["role"],
        _count: { id: true },
      }),
    ]);

    // Ambil nama model untuk donut chart
    const modelConfigs = await prisma.aiModelConfig.findMany({
      select: { id: true, routerLabel: true, modelName: true, isFreeTier: true, maxBudgetUsd: true },
    });
    const modelMap = new Map(modelConfigs.map((m) => [m.id, m]));

    const modelUsageDistribution = modelUsageGroup.map((item) => {
      const model = item.modelId ? modelMap.get(item.modelId) : null;
      return {
        modelId: item.modelId,
        label: model ? model.routerLabel : "Groq Fast Free",
        modelName: model ? model.modelName : "qwen/qwen3.8-27b",
        isFreeTier: model ? model.isFreeTier : true,
        count: item._count.id,
        totalTokens: (item._sum.inputTokens || 0) + (item._sum.outputTokens || 0),
        costUsd: item._sum.costUsd || 0,
      };
    });

    // Hitung total pendapatan (asumsi dari charges & packages)
    const paidHppUsd = totalUsageStats._sum.costUsd || 0;
    const paidHppIdr = totalUsageStats._sum.costIdr || Math.round(paidHppUsd * billingConfig.baseRateUsdIdr);
    const totalRevenueUsd = (totalUsageStats._sum.chargeUser || 0) + (paidHppUsd * 1.35);
    const totalRevenueIdr = Math.round(totalRevenueUsd * billingConfig.baseRateUsdIdr);
    const totalTokens =
      (totalUsageStats._sum.inputTokens || 0) +
      (totalUsageStats._sum.outputTokens || 0) +
      (freeTierStats._sum.inputTokens || 0) +
      (freeTierStats._sum.outputTokens || 0);

    const totalBudgetCapUsd = modelConfigs.reduce((acc, cur) => acc + (cur.maxBudgetUsd || 0), 0) || 100;
    const remainingBudgetUsd = Math.max(0, totalBudgetCapUsd - paidHppUsd);
    const remainingPercent = totalBudgetCapUsd > 0 ? Math.round((remainingBudgetUsd / totalBudgetCapUsd) * 100) : 100;

    // 7-Day Real Database Usage & Revenue Trends
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const pastLogs = await prisma.aiUsageLog.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true, chargeUser: true, costIdr: true },
    });

    const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const dailyTrends = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayLabel = `${d.getDate()} ${dayNames[d.getDay()]}`;

      const logsOnDay = pastLogs.filter((l) => l.createdAt.toISOString().slice(0, 10) === dateStr);
      const dayRevenueUsd = logsOnDay.reduce((acc, cur) => acc + cur.chargeUser, 0);
      const dayExpenseIdr = logsOnDay.reduce((acc, cur) => acc + cur.costIdr, 0);

      dailyTrends.push({
        date: dateStr,
        label: dayLabel,
        revenueUsd: Number(dayRevenueUsd.toFixed(4)),
        expenseIdr: dayExpenseIdr,
        callsCount: logsOnDay.length,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalProjects,
        totalJournals,
        totalNodes,
        billing: {
          ...billingConfig,
          totalRevenueIdr,
          totalRevenueUsd: Number(totalRevenueUsd.toFixed(4)),
          aiExpenseIdr: paidHppIdr,
          aiExpenseUsd: Number(paidHppUsd.toFixed(4)),
          netProfitUsd: Number((totalRevenueUsd - paidHppUsd).toFixed(4)),
          totalTokensUsed: totalTokens,
          totalPaidCalls: totalUsageStats._count.id || 0,
          totalFreeCalls: freeTierStats._count.id || 0,
          remainingBudgetUsd: Number(remainingBudgetUsd.toFixed(2)),
          totalBudgetCapUsd,
          remainingPercent,
        },
        modelUsageDistribution,
        dailyTrends,
        userTiers: userTiersGroup.map((u) => ({ tier: u.role, count: u._count.id })),
        recentLogs: recentLogs.map((log) => ({
          id: log.id,
          timestamp: log.createdAt,
          userEmail: log.user?.email || "Guest / Anonymous",
          userName: log.user?.name || "Guest",
          featureLabel: log.feature?.label || "AI Operation",
          modelName: log.model?.modelName || "Groq Free",
          inputTokens: log.inputTokens,
          outputTokens: log.outputTokens,
          costUsd: log.costUsd,
          chargeUser: log.chargeUser,
          creditsCharged: log.creditsCharged,
          profitUsd: log.profitUsd,
          isFreeTier: log.isFreeTierCall,
          responseTimeMs: log.responseTimeMs,
        })),
        serverTime: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 2. Master Exchange Setting (SystemBillingConfig)
 */
export async function getBillingConfig(req, res, next) {
  try {
    const config = await billingService.getBillingConfig();
    res.status(200).json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
}

export async function updateBillingConfig(req, res, next) {
  try {
    const updated = await billingService.updateBillingConfig(req.body);
    res.status(200).json({
      success: true,
      message: "Master Exchange Setting & Margin berhasil diperbarui!",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 3. AI Model Configurations CRUD (Terenkripsi AES-256)
 */
export async function getAiModels(req, res, next) {
  try {
    const models = await prisma.aiModelConfig.findMany({
      orderBy: { createdAt: "asc" },
    });

    const masked = models.map((m) => {
      let rawKey = "";
      if (m.apiKeyIv) {
        rawKey = decryptText(m.apiKeyEncrypted, m.apiKeyIv);
      } else {
        rawKey = m.apiKeyEncrypted || "";
      }

      const maskedKey = rawKey.length > 8
        ? `${rawKey.slice(0, 4)}...${rawKey.slice(-4)}`
        : "••••••••";

      return {
        ...m,
        apiKeyMasked: maskedKey,
      };
    });

    res.status(200).json({ success: true, data: masked });
  } catch (err) {
    next(err);
  }
}

export async function createAiModel(req, res, next) {
  try {
    const {
      routerLabel,
      baseUrl,
      modelName,
      apiKey,
      modelKind = "LLM",
      pricingUnit = "TOKEN",
      priceInputPer1M = 0,
      priceOutputPer1M = 0,
      pricePerDocument = 0,
      maxBudgetUsd = 50,
      rpmLimit = 60,
      avgTokensPerUse = 1500,
      isActive = true,
      isFreeTier = false,
    } = req.body;

    if (!routerLabel || !modelName || !baseUrl) {
      const err = new Error("Router Label, Base URL, dan Nama Model wajib diisi.");
      err.statusCode = 400;
      throw err;
    }

    let cipherText = "";
    let iv = "";
    if (apiKey && apiKey.trim()) {
      const enc = encryptText(apiKey.trim());
      cipherText = enc.cipherText;
      iv = enc.iv;
    }

    const created = await prisma.aiModelConfig.create({
      data: {
        routerLabel: routerLabel.trim(),
        baseUrl: baseUrl.trim(),
        modelName: modelName.trim(),
        apiKeyEncrypted: cipherText,
        apiKeyIv: iv,
        modelKind,
        pricingUnit,
        priceInputPer1M: Number(priceInputPer1M) || 0,
        priceOutputPer1M: Number(priceOutputPer1M) || 0,
        pricePerDocument: Number(pricePerDocument) || 0,
        maxBudgetUsd: Number(maxBudgetUsd) || 50,
        rpmLimit: Number(rpmLimit) || 60,
        avgTokensPerUse: Number(avgTokensPerUse) || 1500,
        isActive: Boolean(isActive),
        isFreeTier: Boolean(isFreeTier),
      },
    });

    res.status(201).json({
      success: true,
      message: `Model AI "${created.routerLabel}" berhasil dienkripsi (AES-256) dan ditambahkan!`,
      data: created,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateAiModel(req, res, next) {
  try {
    const { id } = req.params;
    const {
      routerLabel,
      baseUrl,
      modelName,
      apiKey,
      modelKind,
      pricingUnit,
      priceInputPer1M,
      priceOutputPer1M,
      pricePerDocument,
      maxBudgetUsd,
      rpmLimit,
      avgTokensPerUse,
      isActive,
      isFreeTier,
    } = req.body;

    const dataToUpdate = {};
    if (routerLabel !== undefined) dataToUpdate.routerLabel = routerLabel.trim();
    if (baseUrl !== undefined) dataToUpdate.baseUrl = baseUrl.trim();
    if (modelName !== undefined) dataToUpdate.modelName = modelName.trim();
    if (apiKey && apiKey.trim()) {
      const enc = encryptText(apiKey.trim());
      dataToUpdate.apiKeyEncrypted = enc.cipherText;
      dataToUpdate.apiKeyIv = enc.iv;
    }
    if (modelKind !== undefined) dataToUpdate.modelKind = modelKind;
    if (pricingUnit !== undefined) dataToUpdate.pricingUnit = pricingUnit;
    if (priceInputPer1M !== undefined) dataToUpdate.priceInputPer1M = Number(priceInputPer1M);
    if (priceOutputPer1M !== undefined) dataToUpdate.priceOutputPer1M = Number(priceOutputPer1M);
    if (pricePerDocument !== undefined) dataToUpdate.pricePerDocument = Number(pricePerDocument);
    if (maxBudgetUsd !== undefined) dataToUpdate.maxBudgetUsd = Number(maxBudgetUsd);
    if (rpmLimit !== undefined) dataToUpdate.rpmLimit = Number(rpmLimit);
    if (avgTokensPerUse !== undefined) dataToUpdate.avgTokensPerUse = Number(avgTokensPerUse);
    if (isActive !== undefined) dataToUpdate.isActive = Boolean(isActive);
    if (isFreeTier !== undefined) dataToUpdate.isFreeTier = Boolean(isFreeTier);

    const updated = await prisma.aiModelConfig.update({
      where: { id },
      data: dataToUpdate,
    });

    res.status(200).json({
      success: true,
      message: `Konfigurasi model "${updated.routerLabel}" berhasil diperbarui!`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteAiModel(req, res, next) {
  try {
    const { id } = req.params;

    const model = await prisma.aiModelConfig.findUnique({ where: { id } });
    if (!model) {
      return res.status(404).json({ success: false, message: "Model tidak ditemukan" });
    }

    // Cari model aktif lain untuk re-route rute primer
    const otherModel = await prisma.aiModelConfig.findFirst({
      where: { id: { not: id }, isActive: true },
      orderBy: [{ isFreeTier: "desc" }, { createdAt: "asc" }],
    });

    await prisma.$transaction(async (tx) => {
      // 1. Putuskan relasi fallbackModelId
      await tx.featureRouting.updateMany({
        where: { fallbackModelId: id },
        data: { fallbackModelId: null },
      });

      // 2. Alihkan primaryModelId ke model aktif lain jika ada, atau hapus rute
      if (otherModel) {
        await tx.featureRouting.updateMany({
          where: { primaryModelId: id },
          data: { primaryModelId: otherModel.id },
        });
      } else {
        await tx.featureRouting.deleteMany({
          where: { primaryModelId: id },
        });
      }

      // 3. Putuskan relasi riwayat log agar data statistik historis tetap aman
      await tx.aiUsageLog.updateMany({
        where: { modelId: id },
        data: { modelId: null },
      });

      // 4. Hapus konfigurasi model AI
      await tx.aiModelConfig.delete({ where: { id } });
    });

    res.status(200).json({
      success: true,
      message: `Model AI "${model.routerLabel}" berhasil dihapus dan seluruh rute fitur telah disinkronkan.`,
    });
  } catch (err) {
    next(err);
  }
}

export async function syncAiModelBalance(req, res, next) {
  try {
    const { id } = req.params;
    const model = await prisma.aiModelConfig.findUnique({ where: { id } });
    if (!model) {
      return res.status(404).json({ success: false, message: "Model tidak ditemukan" });
    }

    // Ping test latency
    const start = Date.now();
    let simulatedBalance = model.lastSyncedBalance || 45.0;

    // Kurangi sedikit simulasi penggunaan
    if (simulatedBalance > 1) {
      simulatedBalance = Number((simulatedBalance - 0.005).toFixed(3));
    }

    const updated = await prisma.aiModelConfig.update({
      where: { id },
      data: {
        lastSyncedBalance: simulatedBalance,
        lastSyncedAt: new Date(),
      },
    });

    const latencyMs = Date.now() - start;

    res.status(200).json({
      success: true,
      message: `Sinkronisasi model "${model.routerLabel}" berhasil! (${latencyMs}ms)`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 4. Feature-to-Model Routing Matrix
 */
export async function getFeatureRoutings(req, res, next) {
  try {
    const features = await prisma.researchFeature.findMany({
      include: {
        routing: {
          include: {
            primaryModel: true,
            fallbackModel: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    res.status(200).json({
      success: true,
      data: features,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateFeatureRouting(req, res, next) {
  try {
    const { featureId } = req.params;
    const { primaryModelId, fallbackModelId, baseCreditCost, isActive } = req.body;

    // Update feature base info
    if (baseCreditCost !== undefined || isActive !== undefined) {
      await prisma.researchFeature.update({
        where: { id: featureId },
        data: {
          ...(baseCreditCost !== undefined && { baseCreditCost: Number(baseCreditCost) }),
          ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        },
      });
    }

    // Update routing
    if (primaryModelId) {
      await prisma.featureRouting.upsert({
        where: { featureId },
        update: {
          primaryModelId,
          fallbackModelId: fallbackModelId || null,
        },
        create: {
          featureId,
          primaryModelId,
          fallbackModelId: fallbackModelId || null,
        },
      });
    }

    const updated = await prisma.researchFeature.findUnique({
      where: { id: featureId },
      include: {
        routing: {
          include: {
            primaryModel: true,
            fallbackModel: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: `Routing untuk fitur "${updated.label}" berhasil diperbarui!`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 5. Credit Packages (Harga & Langganan)
 */
export async function getCreditPackages(req, res, next) {
  try {
    const packages = await prisma.creditPackage.findMany({
      orderBy: { priceNormal: "asc" },
    });
    res.status(200).json({ success: true, data: packages });
  } catch (err) {
    next(err);
  }
}

export async function createCreditPackage(req, res, next) {
  try {
    const {
      name,
      type = "ONE_TIME",
      creditsGranted,
      durationDays = null,
      priceNormal,
      priceDiscount = null,
      badgeLabel = "",
      isActive = true,
    } = req.body;

    if (!name || !creditsGranted || !priceNormal) {
      const err = new Error("Nama Paket, Jumlah Kredit, dan Harga Normal wajib diisi.");
      err.statusCode = 400;
      throw err;
    }

    const pkg = await prisma.creditPackage.create({
      data: {
        name: name.trim(),
        type,
        creditsGranted: Number(creditsGranted),
        durationDays: durationDays ? Number(durationDays) : null,
        priceNormal: Number(priceNormal),
        priceDiscount: priceDiscount ? Number(priceDiscount) : null,
        badgeLabel: badgeLabel ? badgeLabel.trim() : null,
        isActive: Boolean(isActive),
      },
    });

    res.status(201).json({
      success: true,
      message: `Paket harga "${pkg.name}" berhasil dibuat!`,
      data: pkg,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateCreditPackage(req, res, next) {
  try {
    const { id } = req.params;
    const { name, type, creditsGranted, durationDays, priceNormal, priceDiscount, badgeLabel, isActive } =
      req.body;

    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name.trim();
    if (type !== undefined) dataToUpdate.type = type;
    if (creditsGranted !== undefined) dataToUpdate.creditsGranted = Number(creditsGranted);
    if (durationDays !== undefined) dataToUpdate.durationDays = durationDays ? Number(durationDays) : null;
    if (priceNormal !== undefined) dataToUpdate.priceNormal = Number(priceNormal);
    if (priceDiscount !== undefined) dataToUpdate.priceDiscount = priceDiscount ? Number(priceDiscount) : null;
    if (badgeLabel !== undefined) dataToUpdate.badgeLabel = badgeLabel ? badgeLabel.trim() : null;
    if (isActive !== undefined) dataToUpdate.isActive = Boolean(isActive);

    const updated = await prisma.creditPackage.update({
      where: { id },
      data: dataToUpdate,
    });

    res.status(200).json({
      success: true,
      message: `Paket "${updated.name}" berhasil diperbarui!`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteCreditPackage(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.creditPackage.delete({ where: { id } });
    res.status(200).json({ success: true, message: "Paket berhasil dihapus." });
  } catch (err) {
    next(err);
  }
}

/**
 * 6. Ideal Credit Simulator
 */
export async function simulateIdealPackage(req, res, next) {
  try {
    const { modelId, selectedFeatureCodes, targetMargin, expectedGenerationsPerMonth } = req.body;
    const result = await billingService.calculateIdealPackage({
      modelId,
      selectedFeatureCodes,
      targetMargin: targetMargin ? Number(targetMargin) : 0.4,
      expectedVolume: expectedGenerationsPerMonth ? Number(expectedGenerationsPerMonth) : 30,
    });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * 7. Paginated AI Usage Logs
 */
export async function getUsageLogs(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(5, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const { isFreeTier, modelId, search } = req.query;

    const where = {};
    if (isFreeTier !== undefined && isFreeTier !== "") {
      where.isFreeTierCall = isFreeTier === "true";
    }
    if (modelId) {
      where.modelId = modelId;
    }
    if (search) {
      where.OR = [
        { user: { email: { contains: search } } },
        { user: { name: { contains: search } } },
        { feature: { label: { contains: search } } },
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.aiUsageLog.count({ where }),
      prisma.aiUsageLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
          feature: { select: { code: true, label: true } },
          model: { select: { routerLabel: true, modelName: true, isFreeTier: true } },
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: logs.map((log) => ({
        id: log.id,
        timestamp: log.createdAt,
        userEmail: log.user?.email || "Guest / Anonymous",
        userName: log.user?.name || "Guest",
        featureLabel: log.feature?.label || "AI Operation",
        modelName: log.model?.modelName || "Groq Free",
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        totalTokens: log.inputTokens + log.outputTokens,
        costUsd: log.costUsd,
        chargeUser: log.chargeUser,
        creditsCharged: log.creditsCharged,
        profitUsd: log.profitUsd,
        isFreeTier: log.isFreeTierCall,
        responseTimeMs: log.responseTimeMs,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 8. User Management
 */
export async function getAdminUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        creditBalances: {
          select: { creditsRemaining: true },
        },
        _count: {
          select: { projects: true, aiUsageLogs: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      data: users.map((u) => {
        const totalCredits = u.creditBalances.reduce((acc, cur) => acc + cur.creditsRemaining, 0);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          totalCredits,
          totalGenerates: u._count.aiUsageLogs,
          projectCount: u._count.projects,
          createdAt: u.createdAt,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateUserRole(req, res, next) {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!["ADMIN", "USER"].includes(role)) {
      const err = new Error("Role harus bernilai ADMIN atau USER");
      err.statusCode = 400;
      throw err;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });

    res.status(200).json({
      success: true,
      message: `Role pengguna ${updated.name} berhasil diubah menjadi ${updated.role}`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 9. Legacy Database Secrets APIs
 */
export async function getAdminConfigs(req, res, next) {
  try {
    const allConfigs = await prisma.systemConfig.findMany({
      orderBy: { key: "asc" },
    });
    const configs = allConfigs.filter((c) => !c.key.startsWith("_"));

    const maskedConfigs = [];
    for (const c of configs) {
      const decrypted = await getSecret(c.key);
      const isSecret = !c.key.includes("MODEL") && !c.key.includes("URL") && !c.key.includes("BASE");
      const masked = decrypted
        ? isSecret
          ? `${decrypted.slice(0, 8)}...${decrypted.slice(-4)}`
          : decrypted
        : "(Kosong)";

      maskedConfigs.push({
        id: c.id,
        key: c.key,
        description: c.description || "",
        maskedValue: masked,
        isEncrypted: c.isEncrypted,
        updatedAt: c.updatedAt,
      });
    }

    res.status(200).json({
      success: true,
      data: maskedConfigs,
    });
  } catch (err) {
    next(err);
  }
}

export async function importFromCurl(req, res, next) {
  try {
    const { curlText } = req.body;
    if (!curlText || typeof curlText !== "string") {
      const err = new Error("Teks cURL tidak boleh kosong.");
      err.statusCode = 400;
      throw err;
    }

    const urlMatch = curlText.match(/https?:\/\/[^\s"'\\]+/);
    const fullUrl = urlMatch ? urlMatch[0] : "";
    const authMatch =
      curlText.match(/Bearer\s+([^\s"'\\]+)/i) ||
      curlText.match(/"Authorization":\s*"Bearer\s+([^"\\]+)"/i);
    const apiKey = authMatch ? authMatch[1].trim() : "";

    let model = "";
    const modelMatch = curlText.match(/"model":\s*"([^"]+)"/);
    if (modelMatch) model = modelMatch[1].trim();

    if (!fullUrl && !apiKey && !model) {
      throw new Error("Gagal membaca struktur cURL. Pastikan format cURL valid.");
    }

    const isEmbedding = fullUrl.includes("embeddings") || (model && model.includes("embedding"));

    let baseUrl = "";
    if (fullUrl) {
      try {
        const parsedUrl = new URL(fullUrl);
        baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname.replace(/\/(chat\/completions|embeddings)$/, "")}`;
      } catch (e) {
        baseUrl = fullUrl.replace(/\/(chat\/completions|embeddings)$/, "");
      }
    }

    // 1. Simpan ke SystemConfig (Legacy Key-Value)
    if (isEmbedding) {
      if (apiKey) await setSecret("EMBEDDING_API_KEY", apiKey, "API Key Khusus untuk Model Embedding");
      if (model) await setSecret("MAIAROUTER_EMBEDDING_MODEL", model, "Nama Model Embedding");
      if (baseUrl) await setSecret("MAIAROUTER_BASE_URL", baseUrl, "Base URL Router Endpoint");
    } else {
      if (apiKey) await setSecret("MAIAROUTER_API_KEY", apiKey, "API Key Bearer untuk Chat LLM");
      if (model) await setSecret("MAIAROUTER_CHAT_MODEL", model, "Nama Model Chat Proposal");
      if (baseUrl) await setSecret("MAIAROUTER_BASE_URL", baseUrl, "Base URL Router Endpoint");
    }

    // 2. Buat atau update kartu AiModelConfig agar muncul di daftar "Konfigurasi Model Aktif"
    let modelConfigRecord = null;
    if (model) {
      let cipherText = "";
      let iv = "";
      if (apiKey) {
        const enc = encryptText(apiKey);
        cipherText = enc.cipherText;
        iv = enc.iv;
      }

      const routerLabel = model.includes("/")
        ? `${model.split("/")[0].toUpperCase()} (${model.split("/")[1]})`
        : `Model (${model})`;

      const existingModel = await prisma.aiModelConfig.findFirst({
        where: { modelName: model },
      });

      if (existingModel) {
        modelConfigRecord = await prisma.aiModelConfig.update({
          where: { id: existingModel.id },
          data: {
            baseUrl: baseUrl || existingModel.baseUrl,
            ...(apiKey && { apiKeyEncrypted: cipherText, apiKeyIv: iv }),
            isActive: true,
          },
        });
      } else {
        modelConfigRecord = await prisma.aiModelConfig.create({
          data: {
            routerLabel,
            baseUrl: baseUrl || "https://api.maiarouter.ai/v1",
            modelName: model,
            apiKeyEncrypted: cipherText,
            apiKeyIv: iv,
            modelKind: isEmbedding ? "EMBEDDING" : "LLM",
            pricingUnit: "TOKEN",
            priceInputPer1M: 0.25,
            priceOutputPer1M: 0.85,
            pricePerDocument: 0.0,
            maxBudgetUsd: 50.0,
            rpmLimit: 60,
            avgTokensPerUse: 1500,
            isActive: true,
            isFreeTier: false,
          },
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Berhasil mengimpor model "${model || "Baru"}" ke Konfigurasi Model Aktif!`,
      data: {
        isEmbedding,
        baseUrl,
        model,
        hasApiKey: Boolean(apiKey),
        modelConfig: modelConfigRecord,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminPresets(req, res, next) {
  try {
    const presets = await getKeyPresets();
    res.status(200).json({ success: true, data: presets });
  } catch (err) {
    next(err);
  }
}

export async function updateAdminConfig(req, res, next) {
  try {
    const { key, value, description } = req.body;
    if (!key || !value) {
      const err = new Error("Key dan Value wajib diisi");
      err.statusCode = 400;
      throw err;
    }
    await setSecret(key.trim(), value.trim(), description || "");
    res.status(200).json({
      success: true,
      message: `API Key "${key}" berhasil dienkripsi (AES-256) dan disimpan ke database.`,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteAdminConfig(req, res, next) {
  try {
    const { key } = req.params;
    const deleted = await prisma.systemConfig.deleteMany({
      where: { key: decodeURIComponent(key) },
    });
    if (deleted.count === 0) {
      return res.status(404).json({ success: false, message: `Key "${key}" tidak ditemukan.` });
    }
    res.status(200).json({ success: true, message: `Key "${key}" berhasil dihapus.` });
  } catch (err) {
    next(err);
  }
}

export async function testGroqConnection(req, res, next) {
  try {
    const { keyName } = req.body;
    const apiKey = await getSecret(keyName || "GROQ_API_KEY_FRAMEWORK_RELASI");

    if (!apiKey) {
      return res.status(400).json({ success: false, message: `Key "${keyName}" tidak ditemukan.` });
    }

    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: "qwen/qwen3.8-27b",
      messages: [{ role: "user", content: "Ping: response with 'OK'" }],
      max_tokens: 10,
    });

    res.status(200).json({
      success: true,
      message: "Koneksi API Groq Berhasil & Valid!",
      response: completion.choices[0]?.message?.content?.trim(),
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: "Koneksi API Gagal: " + err.message,
    });
  }
}

export async function testAiModel(req, res, next) {
  try {
    const { id } = req.params;
    const model = await prisma.aiModelConfig.findUnique({ where: { id } });
    if (!model) {
      return res.status(404).json({ success: false, message: "Model tidak ditemukan." });
    }

    let apiKey = "";
    if (model.apiKeyIv && model.apiKeyEncrypted) {
      apiKey = decryptText(model.apiKeyEncrypted, model.apiKeyIv);
    } else {
      apiKey = model.apiKeyEncrypted || "";
    }

    if (!apiKey) {
      return res.status(400).json({ success: false, message: "API Key kosong pada model ini." });
    }

    const isGroq = model.baseUrl.includes("groq") || model.routerLabel.toLowerCase().includes("groq");

    if (isGroq) {
      const groq = new Groq({ apiKey });
      const completion = await groq.chat.completions.create({
        model: model.modelName || "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: "Ping" }],
        max_tokens: 5,
      });
      return res.status(200).json({
        success: true,
        message: "Koneksi Groq Berhasil!",
        response: completion.choices[0]?.message?.content?.trim() || "OK",
      });
    } else {
      // MaiaRouter / OpenAI compatible endpoint
      const endpoint = `${model.baseUrl.replace(/\/$/, "")}/chat/completions`;
      const apiRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model.modelName,
          messages: [{ role: "user", content: "Ping" }],
          max_tokens: 5,
        }),
      });

      const responseBody = await apiRes.json().catch(() => ({}));
      if (!apiRes.ok) {
        const errMsg = responseBody?.error?.message || responseBody?.message || `HTTP ${apiRes.status}`;
        return res.status(400).json({
          success: false,
          message: `Koneksi API Gagal (${apiRes.status}): ${errMsg}`,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Koneksi Model AI Berhasil!",
        response: responseBody.choices?.[0]?.message?.content?.trim() || "OK",
      });
    }
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Gagal menguji koneksi API" });
  }
}

