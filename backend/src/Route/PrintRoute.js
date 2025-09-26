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
      textContent, // For text-only printing
    } = req.body;

    // Verify the part exists in the database (skip for text content)
    let relatedPart = null;
    if (partId && !textContent) {
      relatedPart = await Part.findById(partId);
    } else if (!textContent) {
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

    // Create the print job record
    const printJob = new PrintJob({
      partNumber: textContent ? null : partNumber.toUpperCase(),
      model: textContent ? null : model.trim(),
      prefix: textContent ? null : prefix.toUpperCase(),
      startingSerialNo: textContent ? null : startingSerialNo.toUpperCase(),
      endingSerialNo: textContent ? null : endingSerialNo.toUpperCase(),
      textContent: textContent || null,
      quantity: parseInt(quantity),
      totalLabels,
      labelSize,
      copiesPerSerial,
      storageLocation: textContent ? null : storageLocation.trim(),
      partId: relatedPart ? relatedPart._id : null,
      printedBy,
      printNotes: printNotes.trim(),
      printStatus: "processing", // Start as processing
    });

    const savedPrintJob = await printJob.save();

    // ACTUAL PRINTING LOGIC - This is what was missing
    try {
      if (textContent) {
        // Handle text content printing
        await printTextLabels(textContent, totalLabels, labelSize);
      } else {
        // Handle part serial number printing
        await printPartLabels({
          startingSerialNo,
          endingSerialNo,
          quantity,
          totalLabels,
          labelSize,
          partNumber,
          model,
          storageLocation,
        });
      }

      // Update status to completed after successful printing
      await PrintJob.findByIdAndUpdate(savedPrintJob._id, {
        printStatus: "completed",
        printedAt: new Date(),
      });
    } catch (printError) {
      console.error("Printing failed:", printError);

      // Update status to failed
      await PrintJob.findByIdAndUpdate(savedPrintJob._id, {
        printStatus: "failed",
        errorMessage: printError.message,
      });

      return res.status(500).json({
        success: false,
        message: "Print job created but printing failed",
        error: printError.message,
      });
    }

    // Populate the part information if available
    const populatedPrintJob = await PrintJob.findById(
      savedPrintJob._id
    ).populate("partId", "PartNumber Model Prefix StorageLocation");

    res.status(201).json({
      success: true,
      data: populatedPrintJob,
      message: `Print job completed successfully! ${totalLabels} labels printed (${quantity} unique items${
        labelSize === "70x15" ? ", 2 copies each in separate positions" : ""
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

// PRINTING FUNCTIONS - Add these to your codebase

async function printTextLabels(textContent, totalLabels, labelSize) {
  const printerConfig = {
    printerName: process.env.PRINTER_NAME || "default",
    labelSize: labelSize,
    density: 10,
    speed: 2,
  };

  // Print each label separately to ensure proper spacing on roll
  for (let i = 0; i < totalLabels; i++) {
    await printSingleLabel({
      content: textContent,
      type: "text",
      config: printerConfig,
      labelNumber: i + 1,
      totalLabels: totalLabels,
    });

    // Small delay between prints to ensure proper roll advancement
    await sleep(100);
  }
}

async function printPartLabels({
  startingSerialNo,
  endingSerialNo,
  quantity,
  totalLabels,
  labelSize,
  partNumber,
  model,
  storageLocation,
}) {
  const printerConfig = {
    printerName: process.env.PRINTER_NAME || "default",
    labelSize: labelSize,
    density: 10,
    speed: 2,
  };

  // Generate all serial numbers first
  const serialNumbers = generateSerialNumbers(
    startingSerialNo,
    endingSerialNo,
    quantity
  );

  let labelCount = 0;

  for (const serialNo of serialNumbers) {
    const copiesPerSerial = labelSize === "70x15" ? 2 : 1;

    // Print each copy of this serial number separately
    for (let copy = 0; copy < copiesPerSerial; copy++) {
      labelCount++;

      await printSingleLabel({
        content: serialNo,
        type: "part",
        partData: {
          partNumber,
          model,
          storageLocation,
          serialNo,
        },
        config: printerConfig,
        labelNumber: labelCount,
        totalLabels: totalLabels,
        copyNumber: copy + 1,
        copiesPerSerial,
      });

      // Small delay between prints for proper roll advancement
      await sleep(100);
    }
  }
}

async function printSingleLabel({
  content,
  type,
  partData,
  config,
  labelNumber,
  totalLabels,
  copyNumber,
  copiesPerSerial,
}) {
  // This is where you interface with your actual printer
  // Examples for different printer types:

  if (config.printerName.includes("zebra")) {
    await printZebraLabel({ content, type, partData, config, labelNumber });
  } else if (config.printerName.includes("dymo")) {
    await printDymoLabel({ content, type, partData, config, labelNumber });
  } else {
    // Generic printer (you'll need to implement based on your printer)
    await printGenericLabel({ content, type, partData, config, labelNumber });
  }

  console.log(
    `Printed label ${labelNumber}/${totalLabels}: ${content}${
      copyNumber ? ` (copy ${copyNumber}/${copiesPerSerial})` : ""
    }`
  );
}

// Example Zebra printer implementation (ZPL commands)
async function printZebraLabel({
  content,
  type,
  partData,
  config,
  labelNumber,
}) {
  const zplCommand = generateZPLCommand({ content, type, partData, config });

  // Send to printer (implement based on your printer connection method)
  // Options: USB, Network, Serial, etc.
  await sendToPrinter(zplCommand, config.printerName);
}

function generateZPLCommand({ content, type, partData, config }) {
  if (config.labelSize === "70x15") {
    // 70mm x 15mm label with QR code
    return `
^XA
^MMT
^PW560
^LL120
^LS0
^FO30,20^BQN,2,4
^FDQA,${content}^FS
^FO200,30^A0N,25,25^FD${content}^FS
${
  type === "part" && partData.model
    ? `^FO200,55^A0N,18,18^FD${partData.model}^FS`
    : ""
}
^XZ
    `.trim();
  } else {
    // 100mm x 50mm label
    return `
^XA
^MMT
^PW800
^LL400
^LS0
^FO30,30^BQN,2,6
^FDQA,${content}^FS
^FO250,40^A0N,30,30^FD${content}^FS
${
  type === "part"
    ? `
^FO250,80^A0N,20,20^FDModel: ${partData.model}^FS
^FO250,110^A0N,20,20^FDLocation: ${partData.storageLocation || "N/A"}^FS
`
    : ""
}
^XZ
    `.trim();
  }
}

// async function sendToPrinter(command, printerName) {
//   // Implementation depends on your printer connection:

//   // Option 1: Network printer
//   // const net = require('net');
//   // const client = new net.Socket();
//   // await client.connect(9100, printerIP);
//   // client.write(command);
//   // client.end();

//   // Option 2: USB/Serial printer
//   // const printer = require('printer');
//   // printer.printDirect({
//   //   data: command,
//   //   printer: printerName,
//   //   type: "RAW"
//   // });

//   // Option 3: Print service API
//   // await fetch('http://localhost:3001/print', {
//   //   method: 'POST',
//   //   body: JSON.stringify({ command, printer: printerName }),
//   //   headers: { 'Content-Type': 'application/json' }
//   // });

//   // For now, just log the command
//   console.log(`Sending to printer ${printerName}:`, command);
// }

function generateSerialNumbers(startSerial, endSerial, quantity) {
  const serialNumbers = [];
  const startNum = parseInt(startSerial.slice(-3));

  for (let i = 0; i < quantity; i++) {
    const currentNum = startNum + i;
    const serialNo =
      startSerial.slice(0, -3) + String(currentNum).padStart(3, "0");
    serialNumbers.push(serialNo);
  }

  return serialNumbers;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
