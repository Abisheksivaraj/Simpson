const express = require("express");
const router = express.Router();
const ScanHistory = require("../Models/ScanHistoryModel"); // Fixed: Capital S in ScanHistory

// Create new scan history
router.post("/addScanEntry", async (req, res) => {
  try {
    console.log("Creating new scan entry:", req.body);
    const scanEntry = new ScanHistory(req.body);
    const saved = await scanEntry.save();

    res.status(201).json({
      success: true,
      message: "Scan entry created successfully",
      data: saved,
    });
  } catch (err) {
    console.error("Error creating scan entry:", err);
    res.status(400).json({
      success: false,
      message: "Failed to create scan entry",
      error: err.message,
    });
  }
});

// Get all scan histories with query parameters
router.get("/getScanHistory", async (req, res) => {
  try {
    const { limit = 100, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const histories = await ScanHistory.find()
      .sort(sortOptions)
      .limit(parseInt(limit));

    res.json({
      success: true,
      message: "Scan history retrieved successfully",
      data: histories,
    });
  } catch (err) {
    console.error("Error fetching scan history:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch scan history",
      error: err.message,
    });
  }
});

// Get single scan history by ID
router.get("/getScanHistory/:id", async (req, res) => {
  try {
    const history = await ScanHistory.findById(req.params.id);
    if (!history) {
      return res.status(404).json({
        success: false,
        message: "Scan entry not found",
      });
    }

    res.json({
      success: true,
      message: "Scan entry retrieved successfully",
      data: history,
    });
  } catch (err) {
    console.error("Error fetching scan entry:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch scan entry",
      error: err.message,
    });
  }
});

// Update scan history by ID
router.put("/updateScanEntry/:id", async (req, res) => {
  try {
    const updated = await ScanHistory.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Scan entry not found",
      });
    }

    res.json({
      success: true,
      message: "Scan entry updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Error updating scan entry:", err);
    res.status(400).json({
      success: false,
      message: "Failed to update scan entry",
      error: err.message,
    });
  }
});

// Delete scan history by ID
router.delete("/deleteScanEntry/:id", async (req, res) => {
  try {
    const deleted = await ScanHistory.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Scan entry not found",
      });
    }

    res.json({
      success: true,
      message: "Scan entry deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting scan entry:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete scan entry",
      error: err.message,
    });
  }
});

module.exports = router;
