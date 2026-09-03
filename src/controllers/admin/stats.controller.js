import prisma from "../../lib/prisma.js";
import * as billingService from "../../services/billing.service.js";

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

      // Group by Model untuk melihat distribusi pemakaian
      prisma.aiUsageLog.groupBy({
        by: ["modelId"],
        _sum: {
          costUsd: true,
          creditsCharged: true,
          inputTokens: true,
          outputTokens: true,
        },
        _count: { id: true },
      }),

      // 10 Aktivitas AI Terkini
      prisma.aiUsageLog.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
          feature: { select: { code: true, label: true } },
          model: { select: { routerLabel: true, modelName: true, isFreeTier: true } },
        },
      }),

      // User role/tier distribution
      prisma.user.groupBy({
        by: ["role"],
        _count: { id: true },
      }),
    ]);

    // Format financial data
    const totalAiCostUsd = totalUsageStats._sum.costUsd || 0;
    const totalRevenueIdr = (totalUsageStats._sum.chargeUser || 0) * (billingConfig.exchangeRateUsdToIdr || 16200);
    const totalProfitUsd = totalUsageStats._sum.profitUsd || 0;
    const totalTokensProcessed =
      (totalUsageStats._sum.inputTokens || 0) +
      (totalUsageStats._sum.outputTokens || 0) +
      (freeTierStats._sum.inputTokens || 0) +
      (freeTierStats._sum.outputTokens || 0);

    const paidCalls = totalUsageStats._count.id || 0;
    const freeCalls = freeTierStats._count.id || 0;
    const totalAiCalls = paidCalls + freeCalls;

    // Ambil detail model configs untuk melengkapi modelUsageGroup
    const modelIds = modelUsageGroup.map((m) => m.modelId).filter(Boolean);
    const models = await prisma.aiModelConfig.findMany({
      where: { id: { in: modelIds } },
      select: { id: true, routerLabel: true, modelName: true, isFreeTier: true, pricingUnit: true },
    });

    const modelMap = new Map(models.map((m) => [m.id, m]));

    const modelDistribution = modelUsageGroup.map((item) => {
      const model = modelMap.get(item.modelId);
      return {
        modelId: item.modelId,
        label: model?.routerLabel || "Model Tidak Dikenal / Dihapus",
        modelName: model?.modelName || "-",
        isFreeTier: model?.isFreeTier || false,
        totalCalls: item._count.id,
        totalCostUsd: item._sum.costUsd || 0,
        totalTokens: (item._sum.inputTokens || 0) + (item._sum.outputTokens || 0),
        creditsCharged: item._sum.creditsCharged || 0,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        // Kartu Metrik Utama
        executiveMetrics: {
          totalUsers,
          totalProjects,
          totalJournals,
          totalNodes,
          totalAiCalls,
          paidAiCalls: paidCalls,
          freeAiCalls: freeCalls,
          totalTokensProcessed,
          totalAiCostUsd,
          totalRevenueIdr,
          totalProfitUsd,
          currentExchangeRate: billingConfig.exchangeRateUsdToIdr,
          globalProfitMarginPercent: (billingConfig.globalMarginPercent || 0.4) * 100,
        },
        // Distribusi Pemakaian Model
        modelDistribution,
        // Distribusi Pengguna
        userDistribution: userTiersGroup.map((u) => ({
          role: u.role,
          count: u._count.id,
        })),
        // 10 Log Terakhir
        recentActivities: recentLogs.map((log) => ({
          id: log.id,
          timestamp: log.createdAt,
          userEmail: log.user?.email || "Guest",
          userName: log.user?.name || "Guest",
          featureLabel: log.feature?.label || "AI Service",
          modelName: log.model?.modelName || "Groq Free",
          inputTokens: log.inputTokens,
          outputTokens: log.outputTokens,
          costUsd: log.costUsd,
          chargeUser: log.chargeUser,
          creditsCharged: log.creditsCharged,
          isFreeTier: log.isFreeTierCall,
        })),
        serverTime: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 2. Paginated AI Usage Logs
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
