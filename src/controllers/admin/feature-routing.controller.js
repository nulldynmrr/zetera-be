import prisma from "../../lib/prisma.js";

/**
 * Feature-to-Model Routing Matrix
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
