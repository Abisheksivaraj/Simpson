const express = require("express");
const route = express.Router();
const Model = require("../Models/PartModel");

// Add debugging middleware
route.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Request Body:', req.body);
  console.log('Request Params:', req.params);
  console.log('Request Query:', req.query);
  next();
});

// Function to generate SerialNo based on Prefix + Current Year + Current Month + Random
const generateSerialNo = (prefix) => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // Last 2 digits of year
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Month with leading zero
  const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0'); // Random 3-digit number
  
  return `${prefix}${year}${month}${randomNum}`;
};

// Enhanced POST route with StorageLocation support
route.post("/addModels", async (req, res) => {
  console.log("=== ADD MODELS ROUTE CALLED ===");
  console.log("Request body:", req.body);
  
  try {
    const { PartNumber, Model: ModelName, Prefix, StorageLocation } = req.body;
    
    console.log("Extracted data:", { PartNumber, ModelName, Prefix, StorageLocation });

    // Basic validation
    if (!PartNumber || !ModelName || !Prefix) {
      console.log("Validation failed - missing required fields");
      return res.status(400).json({
        success: false,
        message: "PartNumber, Model, and Prefix are required fields"
      });
    }

    // Check if part with same PartNumber already exists
    console.log("Checking for existing part with PartNumber:", PartNumber);
    const existingPart = await Model.findOne({ PartNumber: PartNumber.toUpperCase().trim() });
    
    if (existingPart) {
      console.log("Part already exists:", existingPart);
      return res.status(409).json({
        success: false,
        message: `Part with PartNumber '${PartNumber}' already exists`
      });
    }

    // Generate unique SerialNo (retry if collision occurs)
    let serialNo;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      serialNo = generateSerialNo(Prefix);
      const existingSerial = await Model.findOne({ SerialNo: serialNo });
      if (!existingSerial) break;
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      return res.status(500).json({
        success: false,
        message: "Unable to generate unique serial number. Please try again."
      });
    }

    console.log("Generated SerialNo:", serialNo);

    // Create new part with auto-generated SerialNo and optional StorageLocation
    console.log("Creating new part...");
    const newPart = new Model({
      PartNumber,
      Model: ModelName,
      Prefix,
      SerialNo: serialNo,
      StorageLocation: StorageLocation && StorageLocation.trim() !== '' ? StorageLocation.trim() : null
    });

    console.log("Part object created:", newPart);
    
    const savedPart = await newPart.save();
    console.log("Part saved successfully:", savedPart);

    res.status(201).json({
      success: true,
      message: "Part created successfully",
      data: savedPart
    });

  } catch (error) {
    console.error("Error creating part:", error);
    console.error("Error stack:", error.stack);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const value = error.keyValue[field];
      return res.status(409).json({
        success: false,
        message: `A part with ${field} '${value}' already exists`
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// Enhanced GET route with storage location search
route.get("/getModel", async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 100, 
      search, 
      storageLocation,
      sortBy = "createdAt", 
      sortOrder = "desc" 
    } = req.query;

    // Build search query
    let query = {};
    
    if (search) {
      query = {
        $or: [
          { PartNumber: { $regex: search, $options: "i" } },
          { Model: { $regex: search, $options: "i" } },
          { Prefix: { $regex: search, $options: "i" } },
          { SerialNo: { $regex: search, $options: "i" } },
          { StorageLocation: { $regex: search, $options: "i" } }
        ]
      };
    }

    // Add storage location filter if specified
    if (storageLocation) {
      if (storageLocation.toLowerCase() === 'unspecified' || storageLocation.toLowerCase() === 'null') {
        query.StorageLocation = null;
      } else {
        query.StorageLocation = { $regex: storageLocation, $options: "i" };
      }
    }

    console.log("Search query:", JSON.stringify(query, null, 2));

    // Calculate pagination
    const skip = (page - 1) * limit;
    const sortOptions = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    // Execute query with pagination and sorting
    const parts = await Model
      .find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination info
    const totalParts = await Model.countDocuments(query);
    const totalPages = Math.ceil(totalParts / limit);

    // Get storage location statistics
    const storageStats = await Model.aggregate([
      {
        $group: {
          _id: "$StorageLocation",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: parts,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalParts,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      statistics: {
        storageLocations: storageStats
      }
    });

  } catch (error) {
    console.error("Error fetching parts:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// Enhanced PUT route with StorageLocation support
route.put("/parts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { PartNumber, Model: ModelName, Prefix, StorageLocation } = req.body;

    // Basic validation
    if (!PartNumber || !ModelName || !Prefix) {
      return res.status(400).json({
        success: false,
        message: "PartNumber, Model, and Prefix are required fields"
      });
    }

    // Check if part exists
    const existingPart = await Model.findById(id);
    if (!existingPart) {
      return res.status(404).json({
        success: false,
        message: "Part not found"
      });
    }

    // Check if another part with the same PartNumber exists (excluding current part)
    const duplicatePart = await Model.findOne({ 
      PartNumber: PartNumber.toUpperCase().trim(), 
      _id: { $ne: id } 
    });
    
    if (duplicatePart) {
      return res.status(409).json({
        success: false,
        message: `Another part with PartNumber '${PartNumber}' already exists`
      });
    }

    // Generate new SerialNo if Prefix has changed
    let newSerialNo = existingPart.SerialNo;
    if (Prefix.toUpperCase().trim() !== existingPart.Prefix) {
      // Generate new unique SerialNo
      let attempts = 0;
      const maxAttempts = 10;

      do {
        newSerialNo = generateSerialNo(Prefix);
        const existingSerial = await Model.findOne({ 
          SerialNo: newSerialNo, 
          _id: { $ne: id } 
        });
        if (!existingSerial) break;
        attempts++;
      } while (attempts < maxAttempts);

      if (attempts >= maxAttempts) {
        return res.status(500).json({
          success: false,
          message: "Unable to generate unique serial number. Please try again."
        });
      }
    }

    console.log("Generated/kept SerialNo for update:", newSerialNo);

    // Update the part
    const updatedPart = await Model.findByIdAndUpdate(
      id,
      {
        PartNumber: PartNumber.toUpperCase().trim(),
        Model: ModelName,
        Prefix: Prefix.toUpperCase().trim(),
        SerialNo: newSerialNo,
        StorageLocation: StorageLocation && StorageLocation.trim() !== '' ? StorageLocation.trim() : null
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Part updated successfully",
      data: updatedPart
    });

  } catch (error) {
    console.error("Error updating part:", error);
    
    // Handle invalid ObjectId format
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid part ID format"
      });
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const value = error.keyValue[field];
      return res.status(409).json({
        success: false,
        message: `A part with ${field} '${value}' already exists`
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// New route to get parts by storage location
route.get("/parts/storage/:location", async (req, res) => {
  try {
    const { location } = req.params;
    const { page = 1, limit = 50 } = req.query;

    let query;
    if (location.toLowerCase() === 'unspecified' || location.toLowerCase() === 'null') {
      query = { StorageLocation: null };
    } else {
      query = { StorageLocation: { $regex: location, $options: "i" } };
    }

    const skip = (page - 1) * limit;
    
    const parts = await Model
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalParts = await Model.countDocuments(query);

    res.status(200).json({
      success: true,
      data: parts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalParts / limit),
        totalParts
      }
    });

  } catch (error) {
    console.error("Error fetching parts by storage location:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// Get unique storage locations
route.get("/storage-locations", async (req, res) => {
  try {
    const locations = await Model.distinct("StorageLocation", { StorageLocation: { $ne: null } });
    
    res.status(200).json({
      success: true,
      data: locations.sort()
    });

  } catch (error) {
    console.error("Error fetching storage locations:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// Analytics endpoint
route.get("/analytics", async (req, res) => {
  try {
    // Get total parts count
    const totalParts = await Model.countDocuments();
    
    // Get parts by prefix
    const prefixStats = await Model.aggregate([
      {
        $group: {
          _id: "$Prefix",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get parts by storage location
    const storageStats = await Model.aggregate([
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$StorageLocation", null] },
              "Unspecified",
              "$StorageLocation"
            ]
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get recent activity (parts added in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentParts = await Model.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    res.status(200).json({
      success: true,
      data: {
        totalParts,
        recentActivity: recentParts,
        byPrefix: prefixStats,
        byStorageLocation: storageStats
      }
    });

  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// Keep existing routes (GET by ID, DELETE, PATCH) with minor updates
route.get("/parts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const part = await Model.findById(id);

    if (!part) {
      return res.status(404).json({
        success: false,
        message: "Part not found"
      });
    }

    res.status(200).json({
      success: true,
      data: part
    });

  } catch (error) {
    console.error("Error fetching part:", error);
    
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid part ID format"
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

route.delete("/parts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPart = await Model.findByIdAndDelete(id);

    if (!deletedPart) {
      return res.status(404).json({
        success: false,
        message: "Part not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Part deleted successfully",
      data: deletedPart
    });

  } catch (error) {
    console.error("Error deleting part:", error);
    
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid part ID format"
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

module.exports = route;