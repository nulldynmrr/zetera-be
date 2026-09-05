import { prisma } from "../../lib/prisma.js";

/**
 * ── Research Project & Citation Explorer Controller (Admin) ──
 * Memungkinkan administrator memantau seluruh proyek penelitian pengguna,
 * memeriksa jurnal acuan, membaca bank kutipan bukti berpresisi halaman,
 * serta menyunting/menghapus data jika diperlukan.
 */

// 1. Dapatkan daftar seluruh proyek penelitian beserta metrik jurnal & kutipan
export async function getAdminProjects(req, res, next) {
  try {
    const { search, status, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {};
    if (status && status !== "ALL") {
      where.status = status;
    }
    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim(), mode: "insensitive" } },
        { field: { contains: search.trim(), mode: "insensitive" } },
        { user: { name: { contains: search.trim(), mode: "insensitive" } } },
        { user: { email: { contains: search.trim(), mode: "insensitive" } } },
      ];
    }

    const [projects, total] = await Promise.all([
      prisma.researchProject.findMany({
        where,
        select: {
          id: true,
          title: true,
          field: true,
          nama: true,
          prodi: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              journals: true,
              citationEvidences: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.researchProject.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: projects,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
}

// 2. Dapatkan detail jurnal dan kutipan dari sebuah proyek tertentu
export async function getAdminProjectJournals(req, res, next) {
  try {
    const { id } = req.params;

    const project = await prisma.researchProject.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: `Proyek dengan ID "${id}" tidak ditemukan.`,
      });
    }

    const [journals, citations] = await Promise.all([
      prisma.journal.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.journalCitationEvidence.findMany({
        where: { projectId: id },
        orderBy: [{ journalId: "asc" }, { pageNumber: "asc" }],
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        project,
        journals,
        citations,
      },
    });
  } catch (err) {
    next(err);
  }
}

// 3. Update metadata jurnal oleh admin
export async function updateAdminJournal(req, res, next) {
  try {
    const { id } = req.params;
    const {
      title,
      authors,
      year,
      publication,
      doi,
      url,
      tier,
      status,
      abstract,
      relevanceScore,
    } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (authors !== undefined) updateData.authors = authors;
    if (year !== undefined) updateData.year = year ? Number(year) : null;
    if (publication !== undefined) updateData.publication = publication;
    if (doi !== undefined) updateData.doi = doi;
    if (url !== undefined) updateData.url = url;
    if (tier !== undefined) updateData.tier = tier;
    if (status !== undefined) updateData.status = status;
    if (abstract !== undefined) updateData.abstract = abstract;
    if (relevanceScore !== undefined) updateData.relevanceScore = Number(relevanceScore);

    const updated = await prisma.journal.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json({
      success: true,
      data: updated,
      message: "Data jurnal berhasil diperbarui oleh admin.",
    });
  } catch (err) {
    next(err);
  }
}

// 4. Hapus jurnal oleh admin
export async function deleteAdminJournal(req, res, next) {
  try {
    const { id } = req.params;

    // Hapus relasi kutipan bukti secara eksplisit jika perlu
    await prisma.journalCitationEvidence.deleteMany({
      where: { journalId: id },
    });

    await prisma.journal.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Jurnal dan seluruh bukti kutipannya berhasil dihapus.",
    });
  } catch (err) {
    next(err);
  }
}

// 5. Update kutipan bukti oleh admin
export async function updateAdminCitation(req, res, next) {
  try {
    const { id } = req.params;
    const {
      pageNumber,
      sectionHeading,
      verbatimQuote,
      paraphrasedQuote,
      topicRelevance,
      citationCategory,
      isApproved,
    } = req.body;

    const updateData = {};
    if (pageNumber !== undefined) updateData.pageNumber = Number(pageNumber);
    if (sectionHeading !== undefined) updateData.sectionHeading = sectionHeading;
    if (verbatimQuote !== undefined) updateData.verbatimQuote = verbatimQuote;
    if (paraphrasedQuote !== undefined) updateData.paraphrasedQuote = paraphrasedQuote;
    if (topicRelevance !== undefined) updateData.topicRelevance = topicRelevance;
    if (citationCategory !== undefined) updateData.citationCategory = citationCategory;
    if (isApproved !== undefined) updateData.isApproved = Boolean(isApproved);

    const updated = await prisma.journalCitationEvidence.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json({
      success: true,
      data: updated,
      message: "Kutipan bukti berhasil diperbarui oleh admin.",
    });
  } catch (err) {
    next(err);
  }
}

// 6. Hapus kutipan bukti oleh admin
export async function deleteAdminCitation(req, res, next) {
  try {
    const { id } = req.params;

    await prisma.journalCitationEvidence.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Kutipan bukti berhasil dihapus.",
    });
  } catch (err) {
    next(err);
  }
}
