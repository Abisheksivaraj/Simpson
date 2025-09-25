const mongoose = require("mongoose");

// Generate serial number function
const generateSerialNo = (prefix) => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const serial = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `${prefix}${year}${month}${serial}`;
};

const partSchema = new mongoose.Schema(
  {
    PartNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    Model: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    Prefix: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    SerialNo: {
      type: String,
      unique: true,
      trim: true,
      sparse: true, // Allow multiple null values but unique non-null values
    },
    StorageLocation: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for better query performance
partSchema.index({ PartNumber: 1, Model: 1 });
partSchema.index({ Prefix: 1, SerialNo: 1 });
partSchema.index({ StorageLocation: 1, createdAt: -1 });

// Pre-save middleware
partSchema.pre("save", function (next) {
  // Convert PartNumber to uppercase
  if (this.PartNumber) {
    this.PartNumber = this.PartNumber.toUpperCase().trim();
  }

  // Convert Prefix to uppercase
  if (this.Prefix) {
    this.Prefix = this.Prefix.toUpperCase().trim();
  }

  // Generate SerialNo if not provided and it's a new document
  if (this.isNew && this.Prefix && !this.SerialNo) {
    this.SerialNo = generateSerialNo(this.Prefix);
  }

  // Trim StorageLocation if provided
  if (this.StorageLocation !== undefined) {
    this.StorageLocation = this.StorageLocation.trim();
  }

  next();
});

// Instance method to get formatted display data
partSchema.methods.getDisplayData = function () {
  return {
    id: this._id,
    partNumber: this.PartNumber,
    model: this.Model,
    prefix: this.Prefix,
    serialNo: this.SerialNo,
    storageLocation: this.StorageLocation || "Not specified",
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

// Instance method to regenerate serial number
partSchema.methods.regenerateSerial = function () {
  this.SerialNo = generateSerialNo(this.Prefix);
  return this.save();
};

// Static method to find parts by storage location
partSchema.statics.findByStorageLocation = function (location) {
  return this.find({
    StorageLocation: {
      $regex: new RegExp(location, "i"),
    },
    isActive: true,
  });
};

// Static method for advanced search
partSchema.statics.advancedSearch = function (query) {
  const searchQuery = {
    $and: [
      { isActive: true },
      {
        $or: [
          { PartNumber: { $regex: query, $options: "i" } },
          { Model: { $regex: query, $options: "i" } },
          { Prefix: { $regex: query, $options: "i" } },
          { SerialNo: { $regex: query, $options: "i" } },
          { StorageLocation: { $regex: query, $options: "i" } },
        ],
      },
    ],
  };

  return this.find(searchQuery);
};

// Static method to search parts (compatible with API)
partSchema.statics.searchParts = function (searchTerm, options = {}) {
  const {
    limit = 100,
    skip = 0,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = options;

  let query = { isActive: true };

  if (searchTerm) {
    query.$or = [
      { PartNumber: { $regex: searchTerm, $options: "i" } },
      { Model: { $regex: searchTerm, $options: "i" } },
      { Prefix: { $regex: searchTerm, $options: "i" } },
      { SerialNo: { $regex: searchTerm, $options: "i" } },
    ];
  }

  const sortObj = {};
  sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;

  return this.find(query)
    .sort(sortObj)
    .limit(parseInt(limit))
    .skip(parseInt(skip));
};

// Virtual for full part info
partSchema.virtual("fullInfo").get(function () {
  return `${this.PartNumber} - ${this.Model}`;
});

// Check if model already exists to prevent OverwriteModelError
let Part;
try {
  Part = mongoose.model("Part");
} catch (error) {
  Part = mongoose.model("Part", partSchema);
}

module.exports = Part;
