import { ClientDeliverableTracker } from '../../models/ClientDeliverableTracker.js';
import { Client } from '../../models/Client.js';

export interface SeedResult {
  message: string;
  seededCount: number;
  updatedCount: number;
  totalProcessed: number;
}

export default async function seedDeliverablesFromExcel(): Promise<SeedResult> {
  const septemberData = [
    {
      clientName: 'Graphite homes',
      month: 'September',
      year: 2026,
      cycleLabel: 'September 2026',
      postersTarget: 6,
      videosTarget: 6,
      postersDelivered: 6,
      videosDelivered: 2,
      extraWorksNotes: '',
    },
    {
      clientName: 'Perfect',
      month: 'September',
      year: 2026,
      cycleLabel: 'September 2026',
      postersTarget: 12,
      videosTarget: 8,
      postersDelivered: 10,
      videosDelivered: 5,
      extraWorksNotes: '',
    },
    {
      clientName: 'Polemarks',
      month: 'September',
      year: 2026,
      cycleLabel: 'September 2026',
      postersTarget: 10,
      videosTarget: 6,
      postersDelivered: 12,
      videosDelivered: 3,
      extraWorksNotes: '2 posters',
    },
    {
      clientName: 'Rwen',
      month: 'September',
      year: 2026,
      cycleLabel: 'September 2026',
      postersTarget: 10,
      videosTarget: 5,
      postersDelivered: 10,
      videosDelivered: 3,
      extraWorksNotes: '',
    },
    {
      clientName: 'Nova',
      month: 'September',
      year: 2026,
      cycleLabel: 'September 2026',
      postersTarget: 6,
      videosTarget: 1,
      postersDelivered: 6,
      videosDelivered: 1,
      extraWorksNotes: '',
    },
    {
      clientName: 'Parshi',
      month: 'September',
      year: 2026,
      cycleLabel: 'September 2026',
      postersTarget: 6,
      videosTarget: 3,
      postersDelivered: 6,
      videosDelivered: 3,
      extraWorksNotes: '',
    },
    {
      clientName: 'Welgate',
      month: 'September',
      year: 2026,
      cycleLabel: 'September 2026',
      postersTarget: 9,
      videosTarget: 6,
      postersDelivered: 16,
      videosDelivered: 1,
      extraWorksNotes: '7 poster',
    },
  ];

  const octoberData = [
    {
      clientName: 'GRAPHITE HOMES',
      month: 'October',
      year: 2026,
      cycleLabel: 'SEPT-26 TO OCT 25',
      postersTarget: 6,
      videosTarget: 6,
      postersDelivered: 9,
      videosDelivered: 7,
      extraWorksNotes: '2 POSTERS and (1 extra pending video of september)',
    },
    {
      clientName: 'PERFECT INTERIORS & EXTERIORS',
      month: 'October',
      year: 2026,
      cycleLabel: 'SEPT-26 TO OCT 25',
      postersTarget: 12,
      videosTarget: 8,
      postersDelivered: 4,
      videosDelivered: 4,
      extraWorksNotes: '2 posters (gandhi jayanthi & Vijayadashmi)',
    },
    {
      clientName: 'PARSHI4YOU',
      month: 'October',
      year: 2026,
      cycleLabel: 'SEPT-26 TO OCT 25',
      postersTarget: 6,
      videosTarget: 3,
      postersDelivered: 7,
      videosDelivered: 4,
      extraWorksNotes: '2 POSTERS (GANDHI JAYANTHI & VIJAYADASHMI)',
    },
    {
      clientName: 'NOVA INNOVATIONS',
      month: 'October',
      year: 2026,
      cycleLabel: 'SEPT-26 TO OCT 25',
      postersTarget: 6,
      videosTarget: 1,
      postersDelivered: 4,
      videosDelivered: 1,
      extraWorksNotes: '2 posters (gandhi jayanthi & vijayadashmi)',
    },
    {
      clientName: 'WELGATE LIFESTYLE',
      month: 'October',
      year: 2026,
      cycleLabel: 'SEPT-26 TO OCT 25',
      postersTarget: 9,
      videosTarget: 6,
      postersDelivered: 5,
      videosDelivered: 5,
      extraWorksNotes: '2 posters (gandhi jayanthi & vijayadashmi)',
    },
    {
      clientName: 'POLEMARKS',
      month: 'October',
      year: 2026,
      cycleLabel: 'SEPT-26 TO OCT 25',
      postersTarget: 10,
      videosTarget: 6,
      postersDelivered: 6,
      videosDelivered: 5,
      extraWorksNotes: '2 posters (gandhi jayanthi & vijayadashmi)',
    },
    {
      clientName: 'RWEN',
      month: 'October',
      year: 2026,
      cycleLabel: 'SEPT-26 TO OCT 25',
      postersTarget: 5,
      videosTarget: 5,
      postersDelivered: 7,
      videosDelivered: 12,
      extraWorksNotes: '2 posters (gandhi jayanthi & vijayadashmi)',
    },
    {
      clientName: 'FORESIGHT',
      month: 'October',
      year: 2026,
      cycleLabel: 'SEPT-26 TO OCT 25',
      postersTarget: 10,
      videosTarget: 6,
      postersDelivered: 0,
      videosDelivered: 0,
      extraWorksNotes: '',
    },
    {
      clientName: 'PRANAALAYA',
      month: 'October',
      year: 2026,
      cycleLabel: 'SEPT-26 TO OCT 25',
      postersTarget: 6,
      videosTarget: 4,
      postersDelivered: 7,
      videosDelivered: 8,
      extraWorksNotes: '2 posters (gandhi jayanthi & vijayadashmi)',
    },
    {
      clientName: 'ACDC (IN)',
      month: 'October',
      year: 2026,
      cycleLabel: 'SEPT-26 TO OCT 25',
      postersTarget: 4,
      videosTarget: 0,
      postersDelivered: 5,
      videosDelivered: 0,
      extraWorksNotes: '2 posters (gandhi jayanthi & vijayadashmi)',
    },
    {
      clientName: 'SWARASAAKHI (IN)',
      month: 'October',
      year: 2026,
      cycleLabel: 'SEPT-26 TO OCT 25',
      postersTarget: 4,
      videosTarget: 4,
      postersDelivered: 6,
      videosDelivered: 0,
      extraWorksNotes: '2 posters (gandhi jayanthi & vijayadashmi)',
    },
    {
      clientName: 'RRV SCHOOL (IN)',
      month: 'October',
      year: 2026,
      cycleLabel: 'SEPT-26 TO OCT 25',
      postersTarget: 4,
      videosTarget: 0,
      postersDelivered: 3,
      videosDelivered: 0,
      extraWorksNotes: '2 posters (gandhi jayanthi & vijayadashmi)',
    },
    {
      clientName: 'MISC AUDIBLE (IN)',
      month: 'October',
      year: 2026,
      cycleLabel: 'SEPT-26 TO OCT 25',
      postersTarget: 4,
      videosTarget: 4,
      postersDelivered: 4,
      videosDelivered: 0,
      extraWorksNotes: '2 posters (gandhi jayanthi & vijayadashmi)',
    },
    {
      clientName: 'MISC ARCHIVES (IN)',
      month: 'October',
      year: 2026,
      cycleLabel: 'SEPT-26 TO OCT 25',
      postersTarget: 8,
      videosTarget: 4,
      postersDelivered: 5,
      videosDelivered: 2,
      extraWorksNotes: '2 posters (gandhi jayanthi & vijayadashmi)',
    },
    {
      clientName: 'FLUMENX',
      month: 'October',
      year: 2026,
      cycleLabel: 'SEPT-26 TO OCT 25',
      postersTarget: 6,
      videosTarget: 4,
      postersDelivered: 8,
      videosDelivered: 2,
      extraWorksNotes: '2 posters (gandhi jayanthi & vijayadashmi)',
    },
  ];

  const allItems = [...septemberData, ...octoberData];
  let seededCount = 0;
  let updatedCount = 0;

  for (const item of allItems) {
    const clientDoc = await Client.findOne({
      name: { $regex: new RegExp(`^${item.clientName.trim()}$`, 'i') },
    });

    const pendingPosters = Math.max(0, item.postersTarget - item.postersDelivered);
    const pendingVideos = Math.max(0, item.videosTarget - item.videosDelivered);

    const existing = await ClientDeliverableTracker.findOne({
      clientName: { $regex: new RegExp(`^${item.clientName.trim()}$`, 'i') },
      month: { $regex: new RegExp(`^${item.month.trim()}$`, 'i') },
      year: item.year,
    });

    if (existing) {
      existing.cycleLabel = item.cycleLabel;
      existing.posters = { target: item.postersTarget, delivered: item.postersDelivered, pending: pendingPosters };
      existing.videos = { target: item.videosTarget, delivered: item.videosDelivered, pending: pendingVideos };
      existing.extraWorksNotes = item.extraWorksNotes;
      if (!existing.yearlyTargetPosters) existing.yearlyTargetPosters = item.postersTarget * 12;
      if (!existing.yearlyTargetVideos) existing.yearlyTargetVideos = item.videosTarget * 12;
      if (clientDoc && !existing.client) existing.client = clientDoc._id;
      await existing.save();
      updatedCount++;
    } else {
      await ClientDeliverableTracker.create({
        client: clientDoc?._id,
        clientName: item.clientName.trim(),
        year: item.year,
        month: item.month.trim(),
        cycleLabel: item.cycleLabel,
        posters: { target: item.postersTarget, delivered: item.postersDelivered, pending: pendingPosters },
        videos: { target: item.videosTarget, delivered: item.videosDelivered, pending: pendingVideos },
        yearlyTargetPosters: item.postersTarget * 12,
        yearlyTargetVideos: item.videosTarget * 12,
        extraWorksNotes: item.extraWorksNotes,
        deliveredItems: [],
        status: 'ACTIVE',
      });
      seededCount++;
    }
  }

  return {
    message: `Seeded ${seededCount} records, updated ${updatedCount} records from Excel.`,
    seededCount,
    updatedCount,
    totalProcessed: allItems.length,
  };
}
