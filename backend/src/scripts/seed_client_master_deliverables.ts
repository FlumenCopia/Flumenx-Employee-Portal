import mongoose from 'mongoose';
import { WorkAssignment } from '../models/WorkAssignment.js';
import { Client } from '../models/Client.js';
import { User } from '../models/User.js';

async function seedClientMasterDeliverables() {
  await mongoose.connect('mongodb://127.0.0.1:27017/flumenx_portal');
  console.log('Connected to MongoDB. Seeding Client Master Deliverable Tasks...');

  const adminUser = await User.findOne({ email: 'admin@flumenx.com' });
  const adminId = adminUser ? adminUser._id : null;

  const clients = await Client.find({});
  if (clients.length === 0) {
    console.log('No clients found in database.');
    await mongoose.disconnect();
    return;
  }

  // Define master deliverables for clients
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const deliverablesData = [
    {
      clientName: 'ACME Corp',
      title: 'Q3 Social Media Reels & Brand Campaign',
      description: 'Monthly contracted deliverable: 12 High-Engagement Instagram/LinkedIn Reels with custom motion design & copy.',
      unit: 'Reels',
      assignedQuantity: 12,
      completedQuantity: 5,
      priority: 'High',
      status: 'In Progress',
      daysOffset: 5,
      deliverables: [
        { id: 'del_1', name: 'Reel 01 - Product Launch Teaser', type: 'reel', contracted: 1, delivered: 1, status: 'completed' },
        { id: 'del_2', name: 'Reel 02 - Customer Testimonial', type: 'reel', contracted: 1, delivered: 1, status: 'completed' },
        { id: 'del_3', name: 'Reel 03 - Feature Deep Dive', type: 'reel', contracted: 1, delivered: 1, status: 'completed' },
        { id: 'del_4', name: 'Reel 04 - Behind the Scenes', type: 'reel', contracted: 1, delivered: 1, status: 'completed' },
        { id: 'del_5', name: 'Reel 05 - Founder Interview', type: 'reel', contracted: 1, delivered: 1, status: 'completed' },
        { id: 'del_6', name: 'Reel 06 - Industry Insights', type: 'reel', contracted: 1, delivered: 0, status: 'assigned' },
        { id: 'del_7', name: 'Reel 07 - Trend Adaptation', type: 'reel', contracted: 1, delivered: 0, status: 'assigned' },
        { id: 'del_8', name: 'Reel 08 - Promotional Discount', type: 'reel', contracted: 1, delivered: 0, status: 'assigned' },
        { id: 'del_9', name: 'Reel 09 - UGC Compilation', type: 'reel', contracted: 1, delivered: 0, status: 'assigned' },
        { id: 'del_10', name: 'Reel 10 - Educational Carousel/Reel', type: 'reel', contracted: 1, delivered: 0, status: 'assigned' },
        { id: 'del_11', name: 'Reel 11 - Product Comparison', type: 'reel', contracted: 1, delivered: 0, status: 'assigned' },
        { id: 'del_12', name: 'Reel 12 - Monthly Recap', type: 'reel', contracted: 1, delivered: 0, status: 'assigned' },
      ],
    },
    {
      clientName: 'ACME Corp',
      title: 'SEO & Content Marketing Retainer',
      description: 'Monthly contracted deliverable: 8 Pillar Blog Articles with keyword optimization & backlinking.',
      unit: 'Articles',
      assignedQuantity: 8,
      completedQuantity: 4,
      priority: 'Normal',
      status: 'In Progress',
      daysOffset: 12,
      deliverables: [
        { id: 'del_b1', name: 'Article 01 - Ultimate Guide 2026', type: 'article', contracted: 1, delivered: 1, status: 'completed' },
        { id: 'del_b2', name: 'Article 02 - Case Study Analysis', type: 'article', contracted: 1, delivered: 1, status: 'completed' },
        { id: 'del_b3', name: 'Article 03 - Technical Deep Dive', type: 'article', contracted: 1, delivered: 1, status: 'completed' },
        { id: 'del_b4', name: 'Article 04 - Top 10 Best Practices', type: 'article', contracted: 1, delivered: 1, status: 'completed' },
        { id: 'del_b5', name: 'Article 05 - Comparison Review', type: 'article', contracted: 1, delivered: 0, status: 'assigned' },
        { id: 'del_b6', name: 'Article 06 - Industry Trends', type: 'article', contracted: 1, delivered: 0, status: 'assigned' },
        { id: 'del_b7', name: 'Article 07 - Beginner Checklist', type: 'article', contracted: 1, delivered: 0, status: 'assigned' },
        { id: 'del_b8', name: 'Article 08 - Monthly Round-up', type: 'article', contracted: 1, delivered: 0, status: 'assigned' },
      ],
    },
    {
      clientName: 'Alpha Corp Global',
      title: 'Corporate Brand Identity & Guidelines Revamp',
      description: 'Milestone deliverable: Complete design overhaul covering typography, color palette, logo lockups, and digital asset pack.',
      unit: 'Milestones',
      assignedQuantity: 5,
      completedQuantity: 3,
      priority: 'Urgent',
      status: 'In Review',
      daysOffset: 8,
      deliverables: [
        { id: 'del_m1', name: 'Phase 1: Discovery & Moodboarding', type: 'milestone', contracted: 1, delivered: 1, status: 'completed' },
        { id: 'del_m2', name: 'Phase 2: Primary & Secondary Logo Suites', type: 'milestone', contracted: 1, delivered: 1, status: 'completed' },
        { id: 'del_m3', name: 'Phase 3: Brand Guidelines 40-Page PDF', type: 'milestone', contracted: 1, delivered: 1, status: 'completed' },
        { id: 'del_m4', name: 'Phase 4: Social Media Kit & Templates', type: 'milestone', contracted: 1, delivered: 0, status: 'assigned' },
        { id: 'del_m5', name: 'Phase 5: Final Handover & Sign-off', type: 'milestone', contracted: 1, delivered: 0, status: 'assigned' },
      ],
    },
    {
      clientName: 'Beta Logistics',
      title: 'Monthly Performance Marketing & Lead Gen Ads',
      description: 'Monthly deliverable: Meta & Google Ads creative sets with A/B testing variations and landing page optimization.',
      unit: 'Ad Sets',
      assignedQuantity: 6,
      completedQuantity: 2,
      priority: 'High',
      status: 'In Progress',
      daysOffset: 15,
      deliverables: [
        { id: 'del_ad1', name: 'Campaign 1: Lead Gen Static Ads (Set of 4)', type: 'ad_set', contracted: 1, delivered: 1, status: 'completed' },
        { id: 'del_ad2', name: 'Campaign 2: Video Motion Ads (Set of 3)', type: 'ad_set', contracted: 1, delivered: 1, status: 'completed' },
        { id: 'del_ad3', name: 'Campaign 3: Retargeting Carousels', type: 'ad_set', contracted: 1, delivered: 0, status: 'assigned' },
        { id: 'del_ad4', name: 'Campaign 4: Search Ads Copy Variations', type: 'ad_set', contracted: 1, delivered: 0, status: 'assigned' },
        { id: 'del_ad5', name: 'Campaign 5: Lookalike Audience Creatives', type: 'ad_set', contracted: 1, delivered: 0, status: 'assigned' },
        { id: 'del_ad6', name: 'Campaign 6: End of Month Scaling Creatives', type: 'ad_set', contracted: 1, delivered: 0, status: 'assigned' },
      ],
    },
  ];

  for (const item of deliverablesData) {
    let clientDoc = clients.find((c) => c.name.toLowerCase().includes(item.clientName.toLowerCase()));
    if (!clientDoc) {
      clientDoc = clients[0];
    }

    const dueDate = new Date(currentYear, currentMonth, item.daysOffset);

    // Check if task already exists
    const existing = await WorkAssignment.findOne({
      client: clientDoc._id,
      title: item.title,
      isMasterClientTask: true,
    });

    if (existing) {
      console.log(`- Already exists: ${item.title}`);
      continue;
    }

    const masterTask = new WorkAssignment({
      client: clientDoc._id,
      title: item.title,
      description: item.description,
      isMasterClientTask: true,
      assignedQuantity: item.assignedQuantity,
      completedQuantity: item.completedQuantity,
      unit: item.unit,
      priority: item.priority,
      status: item.status,
      assignedDate: new Date(currentYear, currentMonth, 1),
      dueDate: dueDate,
      deliverables: item.deliverables,
      assignedBy: adminId,
    });

    await masterTask.save();
    console.log(`✓ Seeded Client Master Task: "${item.title}" for ${clientDoc.name} [Due: ${dueDate.toISOString().slice(0, 10)}]`);
  }

  console.log('Seeding complete! 🚀');
  await mongoose.disconnect();
}

seedClientMasterDeliverables().catch(console.error);
