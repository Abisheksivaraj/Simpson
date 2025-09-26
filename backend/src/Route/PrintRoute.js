// routes/printRoutes.js
const express = require("express");
const router = express.Router();
const PrintJob = require("../Models/PrintModel");
const Part = require("../Models/PrintModel");

// Validation middleware for print jobs
const validatePrintJob = (req, res, next) => {
  const {
    partNumber,
    model,
    prefix,
    startingSerialNo,
    endingSerialNo,
    quantity,
    labelSize,
  } = req.body;

  // Required fields validation
  if (
    !partNumber ||
    !model ||
    !prefix ||
    !startingSerialNo ||
    !endingSerialNo ||
    !quantity ||
    !labelSize
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Missing required fields: partNumber, model, prefix, startingSerialNo, endingSerialNo, quantity, labelSize",
    });
  }

  // Validate quantity
  if (quantity < 1 || quantity > 1000) {
    return res.status(400).json({
      success: false,
      message: "Quantity must be between 1 and 1000",
    });
  }

  // Validate label size
  if (!["70x15", "100x50"].includes(labelSize)) {
    return res.status(400).json({
      success: false,
      message: 'Label size must be either "70x15" or "100x50"',
    });
  }

  // Validate serial number format
  const serialPattern = /^[A-Z0-9]+\d{5}$/;
  if (
    !serialPattern.test(startingSerialNo) ||
    !serialPattern.test(endingSerialNo)
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid serial number format",
    });
  }

  next();
};

// POST /api/addPrintJob - Add a new print job
router.post("/addPrintJob", validatePrintJob, async (req, res) => {
  try {
    const {
      partNumber,
      model,
      prefix,
      startingSerialNo,
      endingSerialNo,
      quantity,
      labelSize,
      storageLocation = "",
      partId = null,
      printedBy = "system",
      printNotes = "",
    } = req.body;

    // Verify the part exists in the database
    let relatedPart = null;
    if (partId) {
      relatedPart = await Part.findById(partId);
    } else {
      relatedPart = await Part.findOne({
        PartNumber: partNumber.toUpperCase(),
        isActive: true,
      });
    }

    // Calculate total labels and copies per serial
    let totalLabels = quantity;
    let copiesPerSerial = 1;

    if (labelSize === "70x15") {
      totalLabels = quantity * 2;
      copiesPerSerial = 2;
    }

    // Create the print job
    const printJob = new PrintJob({
      partNumber: partNumber.toUpperCase(),
      model: model.trim(),
      prefix: prefix.toUpperCase(),
      startingSerialNo: startingSerialNo.toUpperCase(),
      endingSerialNo: endingSerialNo.toUpperCase(),
      quantity: parseInt(quantity),
      totalLabels,
      labelSize,
      copiesPerSerial,
      storageLocation: storageLocation.trim(),
      partId: relatedPart ? relatedPart._id : null,
      printedBy,
      printNotes: printNotes.trim(),
      printStatus: "completed",
    });

    const savedPrintJob = await printJob.save();

    // Populate the part information if available
    const populatedPrintJob = await PrintJob.findById(
      savedPrintJob._id
    ).populate("partId", "PartNumber Model Prefix StorageLocation");

    res.status(201).json({
      success: true,
      data: populatedPrintJob,
      message: `Print job created successfully! ${totalLabels} labels queued for printing (${quantity} unique serials${
        labelSize === "70x15" ? ", 2 copies each" : ""
      })`,
    });
  } catch (error) {
    console.error("Error creating print job:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create print job",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/getPrintHistory - Get print history with search and pagination
router.get("/getPrintHistory", async (req, res) => {
  try {
    const {
      search = "",
      limit = 100,
      skip = 0,
      sortBy = "printedAt",
      sortOrder = "desc",
      labelSize,
      startDate,
      endDate,
    } = req.query;

    const options = {
      limit: parseInt(limit),
      skip: parseInt(skip),
      sortBy,
      sortOrder,
      labelSize,
      startDate,
      endDate,
    };

    const printJobs = await PrintJob.searchPrintJobs(search, options);

    // Count total documents for pagination
    let countQuery = {};
    if (search) {
      countQuery.$or = [
        { partNumber: { $regex: search, $options: "i" } },
        { model: { $regex: search, $options: "i" } },
        { startingSerialNo: { $regex: search, $options: "i" } },
        { endingSerialNo: { $regex: search, $options: "i" } },
      ];
    }
    if (labelSize) countQuery.labelSize = labelSize;
    if (startDate || endDate) {
      countQuery.printedAt = {};
      if (startDate) countQuery.printedAt.$gte = new Date(startDate);
      if (endDate) countQuery.printedAt.$lte = new Date(endDate);
    }

    const totalCount = await PrintJob.countDocuments(countQuery);

    res.status(200).json({
      success: true,
      data: printJobs,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: parseInt(skip) + printJobs.length < totalCount,
      },
      message: `Found ${printJobs.length} print jobs`,
    });
  } catch (error) {
    console.error("Error fetching print history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch print history",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/printJobs/:id - Get a specific print job by ID
router.get("/printJobs/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const printJob = await PrintJob.findById(id).populate(
      "partId",
      "PartNumber Model Prefix StorageLocation"
    );

    if (!printJob) {
      return res.status(404).json({
        success: false,
        message: "Print job not found",
      });
    }

    res.status(200).json({
      success: true,
      data: printJob,
      message: "Print job retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching print job:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch print job",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// PUT /api/printJobs/:id/status - Update print job status
router.put("/printJobs/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { printStatus, printNotes = "" } = req.body;

    // Validate status
    const validStatuses = ["pending", "processing", "completed", "failed"];
    if (!validStatuses.includes(printStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const printJob = await PrintJob.findById(id);
    if (!printJob) {
      return res.status(404).json({
        success: false,
        message: "Print job not found",
      });
    }

    printJob.printStatus = printStatus;
    printJob.printNotes = printNotes.trim();

    if (printStatus === "completed" && printJob.printStatus !== "completed") {
      printJob.printedAt = new Date();
    }

    const updatedPrintJob = await printJob.save();

    res.status(200).json({
      success: true,
      data: updatedPrintJob,
      message: `Print job status updated to ${printStatus}`,
    });
  } catch (error) {
    console.error("Error updating print job status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update print job status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// DELETE /api/printJobs/:id - Delete a print job
router.delete("/printJobs/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const printJob = await PrintJob.findById(id);
    if (!printJob) {
      return res.status(404).json({
        success: false,
        message: "Print job not found",
      });
    }

    await PrintJob.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Print job deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting print job:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete print job",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/printJobs/stats - Get print job statistics
router.get("/printJobs/stats", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateRange = {};
    if (startDate) dateRange.startDate = startDate;
    if (endDate) dateRange.endDate = endDate;

    const stats = await PrintJob.getPrintStats(dateRange);

    // Additional statistics
    const totalJobs = await PrintJob.countDocuments();
    const jobsByStatus = await PrintJob.aggregate([
      {
        $group: {
          _id: "$printStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    const jobsByLabelSize = await PrintJob.aggregate([
      {
        $group: {
          _id: "$labelSize",
          count: { $sum: 1 },
          totalLabels: { $sum: "$totalLabels" },
          totalSerials: { $sum: "$quantity" },
        },
      },
    ]);

    // Recent jobs (last 24 hours)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const recentJobs = await PrintJob.countDocuments({
      printedAt: { $gte: twentyFourHoursAgo },
    });

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || {
          totalPrintJobs: 0,
          totalLabels: 0,
          totalSerials: 0,
          avgLabelsPerJob: 0,
        },
        totalJobs,
        recentJobs,
        statusBreakdown: jobsByStatus,
        labelSizeBreakdown: jobsByLabelSize,
      },
      message: "Print statistics retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching print statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch print statistics",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/printJobs/part/:partNumber - Get print jobs for a specific part
router.get("/printJobs/part/:partNumber", async (req, res) => {
  try {
    const { partNumber } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    const printJobs = await PrintJob.find({
      partNumber: partNumber.toUpperCase(),
    })
      .populate("partId", "PartNumber Model Prefix StorageLocation")
      .sort({ printedAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const totalCount = await PrintJob.countDocuments({
      partNumber: partNumber.toUpperCase(),
    });

    res.status(200).json({
      success: true,
      data: printJobs,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: parseInt(skip) + printJobs.length < totalCount,
      },
      message: `Found ${printJobs.length} print jobs for part ${partNumber}`,
    });
  } catch (error) {
    console.error("Error fetching print jobs for part:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch print jobs for part",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// POST /api/printJobs/batch - Create multiple print jobs
router.post("/printJobs/batch", async (req, res) => {
  try {
    const { printJobs } = req.body;

    if (!Array.isArray(printJobs) || printJobs.length === 0) {
      return res.status(400).json({
        success: false,
        message: "printJobs must be a non-empty array",
      });
    }

    if (printJobs.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Cannot create more than 100 print jobs at once",
      });
    }

    const createdJobs = [];
    const errors = [];

    for (let i = 0; i < printJobs.length; i++) {
      try {
        const jobData = printJobs[i];

        // Calculate total labels based on label size
        let totalLabels = jobData.quantity;
        let copiesPerSerial = 1;

        if (jobData.labelSize === "70x15") {
          totalLabels = jobData.quantity * 2;
          copiesPerSerial = 2;
        }

        const printJob = new PrintJob({
          ...jobData,
          totalLabels,
          copiesPerSerial,
          partNumber: jobData.partNumber.toUpperCase(),
          prefix: jobData.prefix.toUpperCase(),
          startingSerialNo: jobData.startingSerialNo.toUpperCase(),
          endingSerialNo: jobData.endingSerialNo.toUpperCase(),
          printStatus: "completed",
        });

        const savedJob = await printJob.save();
        createdJobs.push(savedJob);
      } catch (error) {
        errors.push({
          index: i,
          error: error.message,
        });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        created: createdJobs,
        errors: errors,
      },
      message: `Created ${createdJobs.length} print jobs successfully${
        errors.length > 0 ? `, ${errors.length} failed` : ""
      }`,
    });
  } catch (error) {
    console.error("Error creating batch print jobs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create batch print jobs",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
