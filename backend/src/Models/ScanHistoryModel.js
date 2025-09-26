const mongoose = require("mongoose");

const scanHistorySchema = new mongoose.Schema(
  {
    textContent: { type: String, required: true },
    scannedAt: { type: Date, required: true },
    printed: { type: Boolean, default: false },
    labelSize: { type: String, default: "70x15" },
    status: {
      type: String,
      enum: ["processing", "printed"],
      default: "processing",
    },
  },
  { timestamps: true } // this will auto create `createdAt` & `updatedAt`
);

module.exports = mongoose.model("ScanHistory", scanHistorySchema);
