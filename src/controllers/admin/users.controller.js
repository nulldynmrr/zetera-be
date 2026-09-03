import prisma from "../../lib/prisma.js";

/**
 * User Management (Admin Perspective)
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
