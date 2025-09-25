const mongoose = require("mongoose");

const printJobSchema = new mongoose.Schema(
  {
    partNumber: {
      type: String,
      required: [true, "Part Number is required"],
      trim: true,
      uppercase: true,
      index: true,
    },
    model: {
      type: String,
      required: [true, "Model is required"],
      trim: true,
    },
    prefix: {
      type: String,
      required: [true, "Prefix is required"],
      trim: true,
      uppercase: true,
    },
    startingSerialNo: {
      type: String,
      required: [true, "Starting Serial Number is required"],
      trim: true,
      uppercase: true,
    },
    endingSerialNo: {
      type: String,
      required: [true, "Ending Serial Number is required"],
      trim: true,
      uppercase: true,
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
      max: [1000, "Quantity cannot exceed 1000"],
    },
    totalLabels: {
      type: Number,
      required: [true, "Total Labels is required"],
      min: [1, "Total Labels must be at least 1"],
    },
    labelSize: {
      type: String,
      required: [true, "Label Size is required"],
      enum: ["70x15", "100x50"],
      default: "70x15",
    },
    copiesPerSerial: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
      default: 1,
    },
    storageLocation: {
      type: String,
      trim: true,
      default: "",
    },
    partId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Part",
      index: true,
    },
    printStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "completed",
    },
    printedBy: {
      type: String,
      default: "system",
    },
    printNotes: {
      type: String,
      trim: true,
      default: "",
    },
    printedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
printJobSchema.index({ partNumber: 1, printedAt: -1 });
printJobSchema.index({ partId: 1, printedAt: -1 });
printJobSchema.index({ printedAt: -1 });

// Virtual for serial range
printJobSchema.virtual("serialRange").get(function () {
  return `${this.startingSerialNo} - ${this.endingSerialNo}`;
});

// Virtual for efficiency calculation
printJobSchema.virtual("efficiency").get(function () {
  return this.labelSize === "70x15"
    ? `${this.quantity} serials, ${this.totalLabels} labels (2x each)`
    : `${this.quantity} serials, ${this.totalLabels} labels (1x each)`;
});

// Static method to get print statistics
printJobSchema.statics.getPrintStats = function (dateRange = {}) {
  const { startDate, endDate } = dateRange;
  let matchQuery = {};

  if (startDate || endDate) {
    matchQuery.printedAt = {};
    if (startDate) matchQuery.printedAt.$gte = new Date(startDate);
    if (endDate) matchQuery.printedAt.$lte = new Date(endDate);
  }

  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalPrintJobs: { $sum: 1 },
        totalLabels: { $sum: "$totalLabels" },
        totalSerials: { $sum: "$quantity" },
        avgLabelsPerJob: { $avg: "$totalLabels" },
        labelSizeBreakdown: {
          $push: {
            labelSize: "$labelSize",
            count: 1,
            totalLabels: "$totalLabels",
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        totalPrintJobs: 1,
        totalLabels: 1,
        totalSerials: 1,
        avgLabelsPerJob: { $round: ["$avgLabelsPerJob", 2] },
        labelSizeBreakdown: 1,
      },
    },
  ]);
};

// Static method to search print jobs
printJobSchema.statics.searchPrintJobs = function (searchTerm, options = {}) {
  const {
    limit = 100,
    skip = 0,
    sortBy = "printedAt",
    sortOrder = "desc",
    labelSize,
    startDate,
    endDate,
  } = options;

  let query = {};

  if (searchTerm) {
    query.$or = [
      { partNumber: { $regex: searchTerm, $options: "i" } },
      { model: { $regex: searchTerm, $options: "i" } },
      { startingSerialNo: { $regex: searchTerm, $options: "i" } },
      { endingSerialNo: { $regex: searchTerm, $options: "i" } },
    ];
  }

  if (labelSize) {
    query.labelSize = labelSize;
  }

  if (startDate || endDate) {
    query.printedAt = {};
    if (startDate) query.printedAt.$gte = new Date(startDate);
    if (endDate) query.printedAt.$lte = new Date(endDate);
  }

  const sortObj = {};
  sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;

  return this.find(query)
    .populate("partId", "PartNumber Model Prefix StorageLocation")
    .sort(sortObj)
    .limit(parseInt(limit))
    .skip(parseInt(skip));
};

// Pre-save validation
printJobSchema.pre("save", function (next) {
  // Validate that ending serial is greater than starting serial
  if (this.startingSerialNo && this.endingSerialNo) {
    const startNum = parseInt(this.startingSerialNo.slice(-3));
    const endNum = parseInt(this.endingSerialNo.slice(-3));

    if (endNum < startNum) {
      return next(
        new Error(
          "Ending serial number must be greater than starting serial number"
        )
      );
    }
  }

  // Calculate total labels based on label size
  if (this.labelSize === "70x15") {
    this.copiesPerSerial = 2;
    this.totalLabels = this.quantity * 2;
  } else {
    this.copiesPerSerial = 1;
    this.totalLabels = this.quantity;
  }

  next();
});

// Check if model already exists to prevent OverwriteModelError
let PrintJob;
try {
  PrintJob = mongoose.model("PrintJob");
} catch (error) {
  PrintJob = mongoose.model("PrintJob", printJobSchema);
}

module.exports = PrintJob;
