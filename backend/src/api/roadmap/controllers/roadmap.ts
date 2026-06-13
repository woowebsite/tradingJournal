/**
 * roadmap controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::roadmap.roadmap', ({ strapi }) => ({
  async process(ctx) {
    const documentId = String(ctx.params.documentId || '').trim();
    if (!documentId) {
      return ctx.badRequest('documentId is required');
    }

    const documents = (strapi as any).documents;
    const roadmapUid = 'api::roadmap.roadmap';

    const selectedRoadmap = await documents(roadmapUid).findFirst({
      filters: {
        documentId,
      },
      populate: {
        account: true,
      },
    });

    if (!selectedRoadmap) {
      return ctx.notFound('Roadmap not found');
    }

    const accountDocumentId = selectedRoadmap.account?.documentId || selectedRoadmap.account?.id || null;
    const selectedRoadmapDocumentId = selectedRoadmap.documentId || selectedRoadmap.id;

    const updatedSelectedRoadmap = await documents(roadmapUid).update({
      documentId: selectedRoadmapDocumentId,
      data: {
        status: 'process',
      },
    });

    const relatedRoadmaps = accountDocumentId ? await documents(roadmapUid).findMany({
      filters: {
        account: {
          documentId: {
            $eq: accountDocumentId,
          },
        },
      },
      populate: {
        account: true,
      },
      pagination: {
        limit: -1,
      },
    }) : [];

    const updatedOthers: any[] = [];

    for (const roadmap of relatedRoadmaps) {
      const roadmapDocId = roadmap.documentId || roadmap.id;
      if (!roadmapDocId || String(roadmapDocId) === String(selectedRoadmapDocumentId)) {
        continue;
      }

      const currentStatus = roadmap.status || 'unprocess';
      const nextStatus = currentStatus === 'completed' ? 'completed' : 'unprocess';

      if (currentStatus === nextStatus) {
        updatedOthers.push(roadmap);
        continue;
      }

      const updatedRoadmap = await documents(roadmapUid).update({
        documentId: roadmapDocId,
        data: {
          status: nextStatus,
        },
      });

      updatedOthers.push(updatedRoadmap);
    }

    ctx.body = {
      data: {
        selected: updatedSelectedRoadmap,
        others: updatedOthers,
      },
    };
  },
}));
