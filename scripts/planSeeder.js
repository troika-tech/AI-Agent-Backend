// seeds/planSeeder.js
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Plan = require("../models/Plan");

dotenv.config();

async function seedPlans() {
  try {
    console.log("Connecting to:", process.env.MONGODB_URI);

    await mongoose.connect(process.env.MONGODB_URI);

    const plans = [
      {
        name: "Starter",
        duration_days: 30,
        max_users: 50,
        price: 499,
        is_unlimited: false, // Not an unlimited plan
      },
      {
        name: "Pro",
        duration_days: 90,
        max_users: 500,
        price: 1299,
        is_unlimited: false, // Not an unlimited plan
      },
      {
        name: "Premium",
        duration_days: 365,
        max_users: 2000,
        price: 4499,
        is_unlimited: false, // Not an unlimited plan
      },
      {
        name: "Unlimited",  // New Unlimited Plan
        duration_days: 0,  // Set duration to 0 or any desired value
        max_users: 0,      // Set max_users to 0 to represent unlimited
        price: 9999,       // Set the price for the unlimited plan
        is_unlimited: true, // Mark this as an unlimited plan
      }
    ];

    for (const planData of plans) {
      const exists = await Plan.findOne({ name: planData.name });

      if (exists) {
        console.log(`⚠️  Plan '${planData.name}' already exists. Updating is_unlimited.`);
        await Plan.updateOne(
          { name: planData.name },
          { $set: { is_unlimited: planData.is_unlimited } } // Update the is_unlimited field for existing plans
        );
        continue;
      }

      const plan = new Plan({ ...planData, created_at: new Date() });
      await plan.save();
      console.log(`✅ Plan '${plan.name}' added.`);
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding plans:", err.message);
    process.exit(1);
  }
}

seedPlans();
