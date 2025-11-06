

/**
 * Populate company_id on legacy embedding chunks by looking up each chatbot’s company.
 * Run this once before the re-embed job so company-level dedupe and cache keys stay correct.
 */

'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const Embedding = require('../models/Embedding');
const Chatbot = require('../models/Chatbot');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI environment variable is required');
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 60_000,
  });

  const missingFilter = {
    $or: [
      { company_id: { $exists: false } },
      { company_id: null },
      { company_id: '' },
    ],
    chatbot_id: { $exists: true, $ne: null, $ne: '' },
  };

  const chatbotIds = await Embedding.distinct('chatbot_id', missingFilter);
  console.log(`[backfill] chatbots needing company_id: ${chatbotIds.length}`);

  const objectIds = [];
  const rawToHex = new Map();
  for (const raw of chatbotIds) {
    try {
      const oid = new mongoose.Types.ObjectId(String(raw));
      objectIds.push(oid);
      rawToHex.set(String(raw), oid.toHexString());
    } catch {
      rawToHex.set(String(raw), null); // invalid ObjectId
    }
  }

  const bots = await Chatbot.find({ _id: { $in: objectIds } })
    .select({ company_id: 1 })
    .lean();
  const companyByBot = new Map();
  bots.forEach((bot) => {
    companyByBot.set(bot._id.toHexString(), bot.company_id ? String(bot.company_id) : null);
  });

  let totalUpdated = 0;
  let totalSkipped = 0;
  let missingCompany = 0;

  for (const rawId of chatbotIds) {
    const hexId = rawToHex.get(String(rawId));
    if (!hexId) {
      console.warn(`[backfill] chatbot ${rawId} is not a valid ObjectId; skipping its chunks`);
      totalSkipped += await Embedding.countDocuments({ ...missingFilter, chatbot_id: rawId });
      continue;
    }

    const companyId = companyByBot.get(hexId);
    if (!companyId) {
      console.warn(`[backfill] chatbot ${hexId} has no company; leaving its chunks unchanged`);
      missingCompany += 1;
      continue;
    }

    const now = new Date();
    const res = await Embedding.updateMany(
      { ...missingFilter, chatbot_id: rawId },
      { $set: { company_id: companyId, updatedAt: now } },
    );

    const modified = res.modifiedCount ?? res.nModified ?? 0;
    totalUpdated += modified;
    if (modified > 0) {
      console.log(`[backfill] chatbot ${hexId} -> company ${companyId} (updated ${modified} chunks)`);
    }
  }

  console.log(`[backfill] done — chatbots updated=${totalUpdated}, skipped=${totalSkipped}, missing-company=${missingCompany}`);
  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`[backfill] failed: ${err.stack || err.message}`);
    mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
