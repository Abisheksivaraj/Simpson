import React, { useState, useEffect } from "react";
import {
  Save,
  Edit3,
  Trash2,
  Plus,
  Search,
  RefreshCw,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle,
  Printer,
  MapPin,
  Package,
  X,
  Database,
  Clock,
  Eye,
  QrCode,
  LogOut,
  Calendar,
} from "lucide-react";

import QRCode from "react-qr-code";

import { api } from "./apiConfig";

const generateSerialNo = (prefix, customYear, customMonth) => {
  const now = new Date();
  // Use custom year/month if provided, otherwise use current date
  const year = customYear || now.getFullYear().toString().slice(-2);
  const month = customMonth || (now.getMonth() + 1).toString().padStart(2, "0");
  const serial = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");

  // Check if prefix contains underscores
  if (prefix.includes("_")) {
    // Replace underscores with year and month, then add serial
    const prefixWithDate = prefix.replace(/_/g, year + month);
    return `${prefixWithDate}${serial}`;
  } else {
    // No underscores: append year + month + serial (current behavior)
    return `${prefix}${year}${month}${serial}`;
  }
};

const PartsManagement = () => {
  // Get user role from localStorage
  const [userRole, setUserRole] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [partNo, setPartNo] = useState("");
  const [model, setModel] = useState("");
  const [prefix, setPrefix] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [parts, setParts] = useState([]);
  const [scanHistory, setScanHistory] = useState([]);
  const [printHistory, setPrintHistory] = useState([]);
  const [tableView, setTableView] = useState("parts");
  const [editIndex, setEditIndex] = useState(null);
  const [editId, setEditId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Scanner states
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanInput, setScanInput] = useState("");
  const [scanLoading, setScanLoading] = useState(false);

  // Print dialog states
  const [printDialog, setPrintDialog] = useState(false);
  const [printQuantity, setPrintQuantity] = useState(1);
  const [serialStartFrom, setSerialStartFrom] = useState("00001");
  const [labelSize, setLabelSize] = useState("70x15");
  const [selectedPrintItem, setSelectedPrintItem] = useState(null);
  const [isManualSerialEntry, setIsManualSerialEntry] = useState(false);

  // QR Code dialog states
  const [qrDialog, setQrDialog] = useState(false);
  const [selectedQrItem, setSelectedQrItem] = useState(null);

  // Year/Month override states
  const [customYear, setCustomYear] = useState("");
  const [customMonth, setCustomMonth] = useState("");
  const [showYearMonthOverride, setShowYearMonthOverride] = useState(false);

  // Predefined part number mappings
  const partNumberMappings = {
    SA0500F001: { model: "Isam 550 Master", prefix: "T0515SAMA" },
    SA0700F001: { model: "Isam 460 Master", prefix: "T0714SAMA" },
    SA0300F001: { model: "Isam 800 Master", prefix: "T0318SAMA" },
    SA0400F001: { model: "Isam 800 Pro", prefix: "T0418SAMA" },
    SA0700F004: { model: "Isam 550 Master (SCRG)", prefix: "T0515SAMB" },
    SA0700F003: { model: "Isam 450 Master (SCRG)", prefix: "T0714SAMB" },
    // ADD NEW PART:
    SAMRP5A002: { model: "I5RSP-Reaper self-propelled", prefix: "T_1I5RSPA" },
  };

  // Check if it's December or if user wants to override year/month
  const checkDecemberOverride = () => {
    const currentMonth = new Date().getMonth() + 1; // 1-based month
    return currentMonth === 12 || showYearMonthOverride;
  };

  const getModelAndPrefixByPattern = (partNumber) => {
    const upperPartNo = partNumber.toUpperCase().trim();
    const pattern1 = /^SA(\d{4})F(\d{3})$/;
    const match = upperPartNo.match(pattern1);

    if (match) {
      const [, digits4, digits3] = match;
      let model = "";
      let prefix = "";

      switch (digits4) {
        case "0300":
          model = "Isam 800 Master";
          prefix = "T0318SAMA";
          break;
        case "0400":
          model = "Isam 800 Pro";
          prefix = "T0418SAMA";
          break;
        case "0500":
          model = "Isam 550 Master";
          prefix = "T0515SAMA";
          break;
        case "0700":
          if (digits3 === "00001") {
            model = "Isam 460 Master";
            prefix = "T0714SAMA";
          } else if (digits3 === "003") {
            model = "Isam 450 Master (SCRG)";
            prefix = "T0714SAMB";
          } else if (digits3 === "004") {
            model = "Isam 550 Master (SCRG)";
            prefix = "T0515SAMB";
          } else {
            model = "Isam 460 Master";
            prefix = "T0714SAMA";
          }
          break;
        default:
          model = `Isam Model ${digits4}`;
          prefix = `T${digits4.slice(-2)}${digits3.slice(0, 2)}SAMA`;
          break;
      }
      return { model, prefix };
    }
    return null;
  };

  const getModelAndPrefix = (partNumber) => {
    if (!partNumber || !partNumber.trim()) {
      return { model: "", prefix: "" };
    }

    const upperPartNo = partNumber.toUpperCase().trim();
    if (partNumberMappings[upperPartNo]) {
      return partNumberMappings[upperPartNo];
    }

    const patternResult = getModelAndPrefixByPattern(upperPartNo);
    if (patternResult) {
      return patternResult;
    }

    return { model: "", prefix: "" };
  };

  // Function to find the next serial number based on print history
  const getNextSerialNumber = (prefix) => {
    if (!prefix || printHistory.length === 0) {
      return "00001";
    }

    // Find all print history entries with the same prefix
    const samePrefixPrints = printHistory.filter(
      (print) => print.prefix === prefix
    );

    if (samePrefixPrints.length === 0) {
      return "00001";
    }

    // Get the current or custom year and month for comparison
    const now = new Date();
    const currentYear = customYear || now.getFullYear().toString().slice(-2);
    const currentMonth =
      customMonth || (now.getMonth() + 1).toString().padStart(2, "0");
    const currentYearMonth = currentYear + currentMonth;

    // Find the highest ending serial number for the current month/year
    let highestSerial = 0;

    samePrefixPrints.forEach((print) => {
      if (print.endingSerialNo) {
        // Extract the serial number from the ending serial (last 3 digits)
        const serialMatch = print.endingSerialNo.match(/\d{3}$/);
        if (serialMatch) {
          const serialNum = parseInt(serialMatch[0]);

          // Check if this print is from current year/month
          const printYearMonth = print.endingSerialNo.slice(
            prefix.length,
            prefix.length + 4
          );

          if (
            printYearMonth === currentYearMonth &&
            serialNum > highestSerial
          ) {
            highestSerial = serialNum;
          }
        }
      }
    });

    // Return the next serial number
    const nextSerial = (highestSerial + 1).toString().padStart(3, "0");
    return nextSerial;
  };

  // Delete scan entry function
  const handleDeleteScanEntry = async (scanId, scanText) => {
    if (
      !window.confirm(
        `Are you sure you want to delete scan entry "${scanText}"?`
      )
    ) {
      return;
    }

    try {
      const response = await api.delete(`/deleteScanEntry/${scanId}`);

      if (response.data.success) {
        setScanHistory((prev) => prev.filter((scan) => scan._id !== scanId));
        setSuccess("Scan entry deleted successfully!");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError("Failed to delete scan entry");
      }
    } catch (err) {
      console.error("Error deleting scan entry:", err);
      setError(err.response?.data?.message || "Failed to delete scan entry");
      setTimeout(() => setError(""), 3000);
    }
  };

  // Logout function
  const handleLogout = () => {
    // Clear user data from localStorage
    localStorage.removeItem("user");
    localStorage.removeItem("token"); // If you're storing auth tokens
    localStorage.removeItem("authToken"); // Alternative token name

    // Clear any other auth-related data
    sessionStorage.clear(); // Optional: clear session storage too

    // Navigate to login page
    window.location.href = "/"; // Adjust path as needed

    // Alternative: if using React Router, you could use:
    // navigate("/login"); // if you have useNavigate hook
  };

  useEffect(() => {
    // Check user role on component mount
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        const user = JSON.parse(userData);
        setUserRole(user.role);
        setIsAdmin(user.role === "Admin");
      } catch (error) {
        console.error("Error parsing user data:", error);
        setIsAdmin(false);
      }
    } else {
      setIsAdmin(false);
    }

    fetchParts();
    fetchPrintHistory();
    fetchScanHistory();
  }, []);

  const fetchParts = async () => {
    setTableLoading(true);
    setError("");
    try {
      const response = await api.get("/getModel", {
        params: {
          search: searchTerm,
          limit: 100,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      if (response.data.success) {
        setParts(response.data.data);
      } else {
        setError("Failed to fetch parts");
      }
    } catch (err) {
      console.error("Error fetching parts:", err);
      setError(err.response?.data?.message || "Failed to fetch parts");
    } finally {
      setTableLoading(false);
    }
  };

  const fetchPrintHistory = async () => {
    try {
      const response = await api.get("/getPrintHistory", {
        params: {
          limit: 100,
          sortBy: "printedAt",
          sortOrder: "desc",
        },
      });

      if (response.data.success) {
        setPrintHistory(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching print history:", err);
    }
  };

  const handlePartNoChange = (value) => {
    setPartNo(value);

    if (editIndex !== null) return;

    const { model: autoModel, prefix: autoPrefix } = getModelAndPrefix(value);

    if (autoModel && autoPrefix) {
      setModel(autoModel);
      setPrefix(autoPrefix);
      setSuccess("Part data auto-filled successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } else if (value.trim()) {
      setModel("");
      setPrefix("");
      if (value.trim().length >= 3) {
        setError(
          "Part number pattern not recognized. Please enter Model and Prefix manually."
        );
        setTimeout(() => setError(""), 4000);
      }
    } else {
      setModel("");
      setPrefix("");
    }
  };

  // Add this function to fetch scan history from backend
  const fetchScanHistory = async () => {
    try {
      const response = await api.get("/getScanHistory", {
        params: {
          limit: 100,
          sortBy: "scannedAt",
          sortOrder: "desc",
        },
      });

      if (response.data.success) {
        setScanHistory(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching scan history:", err);
    }
  };

  // Updated handleScanSubmit with backend integration
  const handleScanSubmit = async () => {
    if (!scanInput.trim()) {
      setError("Please enter text to print");
      return;
    }

    setScanLoading(true);
    setError("");

    try {
      const textToPrint = scanInput.trim();

      // Prepare scan entry data for backend
      const scanEntryData = {
        textContent: textToPrint,
        scannedAt: new Date().toISOString(),
        printed: false,
        labelSize: "70x15",
        status: "processing",
      };

      // Save scan entry to backend
      const response = await api.post("/addScanEntry", scanEntryData);

      if (response.data.success) {
        const savedScanEntry = response.data.data;

        // Add to local state immediately
        setScanHistory((prev) => [savedScanEntry, ...prev]);

        // Auto-print after 1 second delay
        setTimeout(async () => {
          try {
            // Update scan entry status to printed in backend
            await api.put(`/updateScanEntry/${savedScanEntry._id}`, {
              printed: true,
              status: "printed",
            });

            // Update local state
            setScanHistory((prev) =>
              prev.map((item) =>
                item._id === savedScanEntry._id
                  ? { ...item, printed: true, status: "printed" }
                  : item
              )
            );

            // Add to print history
            const printJob = {
              textContent: textToPrint,
              quantity: 1,
              totalLabels: 2, // 70x15 prints 2 copies
              labelSize: "70x15",
              printedAt: new Date().toISOString(),
              scanEntryId: savedScanEntry._id, // Reference to scan entry
            };

            // Save print job to backend
            const printResponse = await api.post("/addPrintJob", printJob);
            if (printResponse.data.success) {
              setPrintHistory((prev) => [
                printResponse.data.data || printJob,
                ...prev,
              ]);
            }
          } catch (updateError) {
            console.error("Error updating scan entry:", updateError);
          }
        }, 1000);

        setSuccess(
          `Text "${textToPrint}" scanned and will be printed (2 labels, 70x15mm)!`
        );
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError("Failed to save scan entry to database");
      }
    } catch (err) {
      console.error("Error saving scan entry:", err);
      setError("Failed to process and save scan entry");
    } finally {
      setScanLoading(false);
      setScannerOpen(false);
      setScanInput("");
    }
  };

  // Updated scan history table to include delete button
  const renderScanHistoryTable = () => (
    <table className="w-full">
      <thead className="bg-gray-100/80">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Text Content
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Status
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Scanned At
          </th>
          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="bg-white/50 divide-y divide-gray-200">
        {scanHistory.map((scan) => (
          <tr
            key={scan._id || scan.id}
            className="hover:bg-purple-50/50 transition-colors duration-150"
          >
            <td className="px-6 py-4 whitespace-nowrap">
              <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-lg font-bold text-sm">
                {scan.textContent}
              </span>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
              {scan.printed || scan.status === "printed" ? (
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-lg font-medium text-sm flex items-center space-x-1">
                  <CheckCircle className="h-3 w-3" />
                  <span>Printed (2 labels)</span>
                </span>
              ) : (
                <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-lg font-medium text-sm flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>Processing</span>
                </span>
              )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {new Date(scan.scannedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-center">
              <div className="flex justify-center space-x-2">
                <button
                  onClick={() =>
                    handleQrClick({ textContent: scan.textContent })
                  }
                  className="text-purple-600 hover:text-purple-900 p-2 hover:bg-purple-100 rounded-lg transition-colors"
                  title="View QR code"
                >
                  <QrCode className="h-4 w-4" />
                </button>
                <button
                  onClick={() =>
                    handlePrintClick({ textContent: scan.textContent })
                  }
                  className="text-green-600 hover:text-green-900 p-2 hover:bg-green-100 rounded-lg transition-colors"
                  title="Print again"
                >
                  <Printer className="h-4 w-4" />
                </button>
                <button
                  onClick={() =>
                    handleDeleteScanEntry(scan._id, scan.textContent)
                  }
                  className="text-red-600 hover:text-red-900 p-2 hover:bg-red-100 rounded-lg transition-colors"
                  title="Delete scan entry"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // Add refresh button functionality for scan history
  const handleRefreshScanHistory = async () => {
    setTableLoading(true);
    try {
      await fetchScanHistory();
      setSuccess("Scan history refreshed successfully!");
      setTimeout(() => setSuccess(""), 2000);
    } catch (error) {
      setError("Failed to refresh scan history");
      setTimeout(() => setError(""), 3000);
    } finally {
      setTableLoading(false);
    }
  };

  const handleSave = async () => {
    if (!partNo || !model || !prefix) {
      setError("Part Number, Model, and Prefix are required");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      let response;

      if (editIndex !== null) {
        response = await api.put(`/parts/${editId}`, {
          PartNumber: partNo,
          Model: model,
          Prefix: prefix,
          StorageLocation: storageLocation,
        });

        setParts((prev) =>
          prev.map((part) =>
            part._id === editId
              ? {
                  ...part,
                  PartNumber: partNo,
                  Model: model,
                  Prefix: prefix,
                  StorageLocation: storageLocation,
                }
              : part
          )
        );
      } else {
        response = await api.post("/addModels", {
          PartNumber: partNo,
          Model: model,
          Prefix: prefix,
          StorageLocation: storageLocation,
        });

        setParts((prev) => [response.data.data, ...prev]);
      }

      if (response.data.success) {
        const serialNoInfo = response.data.data.SerialNo
          ? ` (Serial No: ${response.data.data.SerialNo})`
          : "";
        setSuccess(
          editIndex !== null
            ? `Part updated successfully!${serialNoInfo}`
            : `Part saved successfully!${serialNoInfo}`
        );
        resetForm();
      } else {
        setError(response.data.message || "Failed to save part");
      }
    } catch (error) {
      if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else {
        setError("Failed to save part. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPartNo("");
    setModel("");
    setPrefix("");
    setStorageLocation("");
    setEditIndex(null);
    setEditId(null);
  };

  const handleEdit = (part, index) => {
    setPartNo(part.PartNumber);
    setModel(part.Model);
    setPrefix(part.Prefix);
    setStorageLocation(part.StorageLocation || "");
    setEditIndex(index);
    setEditId(part._id);
    setError("");
    setSuccess("");
  };

  const handleDelete = async (partId, partNumber) => {
    if (
      !window.confirm(`Are you sure you want to delete part ${partNumber}?`)
    ) {
      return;
    }

    try {
      const response = await api.delete(`/parts/${partId}`);

      if (response.data.success) {
        setParts((prev) => prev.filter((part) => part._id !== partId));
        setSuccess("Part deleted successfully!");
      }
    } catch (err) {
      console.error("Error deleting part:", err);
      setError(err.response?.data?.message || "Failed to delete part");
    }
  };

  const handlePrintClick = (item) => {
    setSelectedPrintItem(item);

    // Get the prefix for this item
    const itemPrefix = item?.Prefix || item?.prefix || "";

    // Calculate the next serial number automatically
    const nextSerial = getNextSerialNumber(itemPrefix);

    // Set the starting serial number
    setSerialStartFrom(nextSerial);

    // Check if this is the first time printing this prefix (no history)
    const hasHistory = printHistory.some(
      (print) => print.prefix === itemPrefix
    );
    setIsManualSerialEntry(!hasHistory);

    // Reset custom year/month when opening print dialog
    setCustomYear("");
    setCustomMonth("");
    setShowYearMonthOverride(checkDecemberOverride());

    setPrintDialog(true);
  };

  const handleQrClick = (item) => {
    setSelectedQrItem(item);
    setQrDialog(true);
  };

  const executePrint = async () => {
    try {
      // Handle text content printing differently
      if (selectedPrintItem?.textContent) {
        const printJob = {
          textContent: selectedPrintItem.textContent,
          quantity: printQuantity,
          totalLabels: printQuantity * 2, // 70x15 prints 2 copies
          labelSize: labelSize,
          printedAt: new Date().toISOString(),
        };

        setPrintHistory((prev) => [printJob, ...prev]);
        setSuccess(
          `Text "${selectedPrintItem.textContent}" printed! ${printJob.totalLabels} labels`
        );

        setPrintDialog(false);
        setSelectedPrintItem(null);
        setPrintQuantity(1);
        setSerialStartFrom("00001");
        setLabelSize("70x15");
        setIsManualSerialEntry(false);
        return;
      }

      // Original part printing logic with year/month override
      const startSerial = parseInt(serialStartFrom || "00001");
      const endSerial = startSerial + printQuantity - 1;
      const prefix =
        selectedPrintItem?.Prefix || selectedPrintItem?.prefix || "";

      // Generate starting and ending serial numbers with custom year/month
      const now = new Date();
      const year = customYear || now.getFullYear().toString().slice(-2);
      const month =
        customMonth || (now.getMonth() + 1).toString().padStart(2, "0");

      const startSerialNo = `${prefix}${year}${month}${String(
        startSerial
      ).padStart(3, "0")}`;
      const endSerialNo = `${prefix}${year}${month}${String(endSerial).padStart(
        3,
        "0"
      )}`;

      // Calculate total labels based on label size
      let totalLabels = printQuantity;
      if (labelSize === "70x15") {
        totalLabels = printQuantity * 2; // Each serial number prints twice for 70x15mm
      }

      // Prepare print job data
      const printJobData = {
        partNumber:
          selectedPrintItem?.PartNumber || selectedPrintItem?.partNumber,
        model: selectedPrintItem?.Model || selectedPrintItem?.model,
        prefix: prefix,
        startingSerialNo: startSerialNo,
        endingSerialNo: endSerialNo,
        quantity: printQuantity,
        totalLabels: totalLabels,
        labelSize: labelSize,
        copiesPerSerial: labelSize === "70x15" ? 2 : 1,
        printedAt: new Date().toISOString(),
        partId: selectedPrintItem?._id || selectedPrintItem?.id,
        storageLocation:
          selectedPrintItem?.StorageLocation ||
          selectedPrintItem?.storageLocation ||
          "",
        customYear: customYear,
        customMonth: customMonth,
      };

      // Save print job to database
      const response = await api.post("/addPrintJob", printJobData);

      if (response.data.success) {
        // Add to local print history
        setPrintHistory((prev) => [
          response.data.data || printJobData,
          ...prev,
        ]);

        setSuccess(
          `Print job saved! ${totalLabels} labels (Serials: ${startSerialNo} to ${endSerialNo}${
            labelSize === "70x15" ? ", 2 copies each" : ""
          }${customYear || customMonth ? " - Custom Date Used" : ""})`
        );
      } else {
        setError("Print job sent but failed to save record");
      }
    } catch (error) {
      console.error("Error saving print job:", error);
      setError("Print job sent but failed to save to database");
    } finally {
      setPrintDialog(false);
      setSelectedPrintItem(null);
      // Reset form
      setPrintQuantity(1);
      setSerialStartFrom("00001");
      setLabelSize("70x15");
      setIsManualSerialEntry(false);
      setCustomYear("");
      setCustomMonth("");
      setShowYearMonthOverride(false);
    }
  };

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError("");
        setSuccess("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const filteredParts = parts.filter(
    (part) =>
      part.PartNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.Model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.Prefix?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Simplified QR data function
  const createQRData = (item) => {
    if (!item) return "";

    // If it's a scan history item with textContent, return just the text
    if (item.textContent) {
      return item.textContent;
    }

    // For part data, return the part number or the full JSON
    if (item.PartNumber || item.partNumber) {
      return item.PartNumber || item.partNumber;
    }

    // Fallback for complex part data
    const qrData = {
      partNumber: item.PartNumber || item.partNumber || "",
      model: item.Model || item.model || "",
      serialNo: item.SerialNo || item.serialNo || "N/A",
      prefix: item.Prefix || item.prefix || "",
      storageLocation: item.StorageLocation || item.storageLocation || "N/A",
    };

    return JSON.stringify(qrData);
  };

  // Generate preview serial number with custom year/month
  const getPreviewSerialNo = () => {
    if (!selectedPrintItem) return `T0515SAMA25090001`;

    // Handle text content
    if (selectedPrintItem.textContent) {
      return selectedPrintItem.textContent;
    }

    const prefix =
      selectedPrintItem.Prefix || selectedPrintItem.prefix || "T0515SAMA";
    const now = new Date();
    const year = customYear || now.getFullYear().toString().slice(-2);
    const month =
      customMonth || (now.getMonth() + 1).toString().padStart(2, "0");
    const serial = (serialStartFrom || "00001").padStart(3, "0");

    // Check if prefix contains underscores
    if (prefix.includes("_")) {
      // Replace underscores with year and month, then add serial
      const prefixWithDate = prefix.replace(/_/g, year + month);
      return `${prefixWithDate}${serial}`;
    } else {
      // No underscores: append year + month + serial
      return `${prefix}${year}${month}${serial}`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-white/20 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-xl shadow-lg">
                <Package className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Parts Management System
                </h1>
                <p className="text-gray-600">
                  {isAdmin
                    ? "Add new parts and manage your inventory"
                    : "View and manage parts inventory"}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => setScannerOpen(true)}
                className="relative bg-gradient-to-r from-green-500 to-emerald-600 text-white p-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-1"
              >
                <QrCode className="h-6 w-6" />
                {scanHistory.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center">
                    {scanHistory.length}
                  </span>
                )}
              </button>

              <button
                onClick={fetchParts}
                disabled={tableLoading}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-3 rounded-lg transition-colors"
              >
                <RefreshCw
                  className={`h-6 w-6 ${tableLoading ? "animate-spin" : ""}`}
                />
              </button>

              {/* User Role Indicator */}
              <div className="bg-blue-100 text-blue-800 px-3 py-2 rounded-lg font-medium text-sm">
                {userRole || "User"}
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="bg-gradient-to-r from-red-500 to-red-600 text-white p-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-1 flex items-center space-x-2"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alert Messages */}
        {(error || success) && (
          <div className="mb-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-red-800">Error</h3>
                  <p className="text-red-700">{error}</p>
                </div>
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-green-800">Success</h3>
                  <p className="text-green-700">{success}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Admin Only: Add New Part Form Section */}
        {isAdmin && (
          <div id="parts-form" className="mb-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                      <Plus className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {editIndex !== null
                          ? "Edit Part Details"
                          : "Add New Part"}
                      </h2>
                      <p className="text-blue-100">
                        {editIndex !== null
                          ? "Update part information"
                          : "Enter all part details in a single row"}
                      </p>
                    </div>
                  </div>
                  {editIndex !== null && (
                    <button
                      onClick={resetForm}
                      className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </div>

              <div className="p-6">
                {/* Single Row Form */}
                <div className="flex flex-col lg:flex-row gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Part Number *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={partNo}
                        onChange={(e) => handlePartNoChange(e.target.value)}
                        placeholder="Enter part number"
                        disabled={loading}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      />
                      {partNo && model && (
                        <CheckCircle className="absolute right-3 top-3 h-6 w-6 text-green-500" />
                      )}
                    </div>
                  </div>

                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Model *
                    </label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="Auto-filled or manual entry"
                      disabled={loading}
                      className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                        model ? "bg-green-50" : ""
                      }`}
                    />
                  </div>

                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Prefix *
                    </label>
                    <input
                      type="text"
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value)}
                      placeholder="Auto-filled or manual entry"
                      disabled={loading}
                      className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                        prefix ? "bg-green-50" : ""
                      }`}
                    />
                  </div>

                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Storage Location
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-6 w-6 text-gray-400" />
                      <input
                        type="text"
                        value={storageLocation}
                        onChange={(e) => setStorageLocation(e.target.value)}
                        placeholder="Optional location"
                        disabled={loading}
                        className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      />
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    {editIndex !== null && (
                      <button
                        onClick={resetForm}
                        className="px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={handleSave}
                      disabled={!partNo || !model || !prefix || loading}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-200 hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {loading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      ) : (
                        <Save className="h-5 w-5" />
                      )}
                      <span>
                        {loading
                          ? "Saving..."
                          : editIndex !== null
                          ? "Update"
                          : "Save"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Auto-fill indicator */}
                {prefix && (
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-blue-800">
                          Auto-Generated Information
                        </h4>
                        <p className="text-blue-700 mt-1">
                          Prefix:{" "}
                          <span className="bg-blue-100 px-2 py-1 rounded font-mono">
                            {prefix}
                          </span>
                          - Serial numbers will be auto-generated during
                          save/print
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Table Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
              <div className="flex bg-white rounded-lg p-1 shadow-sm">
                <button
                  onClick={() => setTableView("parts")}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all duration-200 ${
                    tableView === "parts"
                      ? "bg-blue-600 text-white shadow-md"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  <Database className="h-4 w-4" />
                  <span className="font-medium">Parts Database</span>
                </button>
                <button
                  onClick={() => setTableView("scans")}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all duration-200 ${
                    tableView === "scans"
                      ? "bg-purple-600 text-white shadow-md"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  <QrCode className="h-4 w-4" />
                  <span className="font-medium">Scan History</span>
                  {scanHistory.length > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {scanHistory.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setTableView("prints")}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all duration-200 ${
                    tableView === "prints"
                      ? "bg-green-600 text-white shadow-md"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  <Printer className="h-4 w-4" />
                  <span className="font-medium">Print History</span>
                  {printHistory.length > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {printHistory.length}
                    </span>
                  )}
                </button>
              </div>

              <div className="flex items-center space-x-3">
                {tableView === "parts" && (
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search parts..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      disabled={tableLoading}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                    />
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <button className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    <Filter className="h-4 w-4" />
                    <span>Filter</span>
                  </button>

                  <button className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    <Download className="h-4 w-4" />
                    <span>Export</span>
                  </button>

                  <div className="bg-blue-100 text-blue-800 px-3 py-2 rounded-lg font-medium text-sm">
                    {tableView === "parts"
                      ? tableLoading
                        ? "Loading..."
                        : `${filteredParts.length} parts`
                      : tableView === "scans"
                      ? `${scanHistory.length} scans`
                      : `${printHistory.length} prints`}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {tableView === "parts" ? (
              tableLoading ? (
                <div className="text-center py-16">
                  <div className="inline-flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        Loading parts...
                      </h3>
                      <p className="text-gray-600">
                        Please wait while we fetch your data
                      </p>
                    </div>
                  </div>
                </div>
              ) : filteredParts.length === 0 ? (
                <div className="text-center py-16">
                  <div className="bg-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                    <Package className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    No parts found
                  </h3>
                  <p className="text-gray-600 max-w-md mx-auto">
                    {searchTerm
                      ? "Try adjusting your search criteria or add new parts to get started."
                      : "Your parts inventory is empty. Start by adding your first part using the form above."}
                  </p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-100/80">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Part Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Model
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Prefix
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Serial Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Storage Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created At
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white/50 divide-y divide-gray-200">
                    {filteredParts.map((part, index) => (
                      <tr
                        key={part._id}
                        className="hover:bg-blue-50/50 transition-colors duration-150"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg font-bold text-sm">
                            {part.PartNumber}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-semibold text-gray-900">
                            {part.Model}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-lg font-medium text-sm">
                            {part.Prefix}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-lg font-mono text-sm font-bold">
                            {part.SerialNo}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {part.StorageLocation ? (
                            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-lg font-medium text-sm flex items-center space-x-1">
                              <MapPin className="h-3 w-3" />
                              <span>{part.StorageLocation}</span>
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">
                              Not specified
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(part.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex justify-center space-x-2">
                            <button
                              onClick={() => handleQrClick(part)}
                              className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-100 rounded-lg transition-colors"
                              title="View QR code"
                            >
                              <QrCode className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handlePrintClick(part)}
                              className="text-green-600 hover:text-green-900 p-2 hover:bg-green-100 rounded-lg transition-colors"
                              title="Print labels"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                            {/* Admin-only actions */}
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => handleEdit(part, index)}
                                  className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-100 rounded-lg transition-colors"
                                  title="Edit part"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleDelete(part._id, part.PartNumber)
                                  }
                                  className="text-red-600 hover:text-red-900 p-2 hover:bg-red-100 rounded-lg transition-colors"
                                  title="Delete part"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : tableView === "scans" ? (
              // Scan History Table - Updated with delete button
              scanHistory.length === 0 ? (
                <div className="text-center py-16">
                  <div className="bg-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                    <QrCode className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    No scan history
                  </h3>
                  <p className="text-gray-600 max-w-md mx-auto">
                    Start scanning text using the QR scanner to see your scan
                    history here.
                  </p>
                </div>
              ) : (
                renderScanHistoryTable()
              )
            ) : // Print History Table - Updated for text content
            printHistory.length === 0 ? (
              <div className="text-center py-16">
                <div className="bg-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                  <Printer className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  No print history
                </h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  Start printing labels to see your print history here.
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-100/80">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Content
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Label Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Labels
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Printed At
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white/50 divide-y divide-gray-200">
                  {printHistory.map((print, index) => (
                    <tr
                      key={print._id || print.id || index}
                      className="hover:bg-green-50/50 transition-colors duration-150"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-lg font-bold text-sm">
                          {print.textContent || print.partNumber}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 rounded-lg font-medium text-sm ${
                            print.textContent
                              ? "bg-purple-100 text-purple-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {print.textContent ? "Text" : "Part"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg font-medium text-sm">
                          {print.labelSize}mm
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-lg font-medium text-sm">
                          {print.totalLabels} labels
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(print.printedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex justify-center space-x-2">
                          <button
                            onClick={() =>
                              handleQrClick(
                                print.textContent
                                  ? { textContent: print.textContent }
                                  : {
                                      PartNumber: print.partNumber,
                                      Model: print.model,
                                      Prefix: print.prefix,
                                      SerialNo: print.startingSerialNo,
                                      StorageLocation: print.storageLocation,
                                    }
                              )
                            }
                            className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-100 rounded-lg transition-colors"
                            title="View QR code"
                          >
                            <QrCode className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              handlePrintClick(
                                print.textContent
                                  ? { textContent: print.textContent }
                                  : {
                                      PartNumber: print.partNumber,
                                      Model: print.model,
                                      Prefix: print.prefix,
                                      StorageLocation: print.storageLocation,
                                    }
                              )
                            }
                            className="text-green-600 hover:text-green-900 p-2 hover:bg-green-100 rounded-lg transition-colors"
                            title="Print again"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* QR Code Dialog */}
      {qrDialog && selectedQrItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-lg">
                  <QrCode className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">QR Code</h3>
                  <p className="text-gray-600">
                    {selectedQrItem.textContent ||
                      selectedQrItem.PartNumber ||
                      selectedQrItem.partNumber ||
                      "Content"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQrDialog(false)}
                className="text-gray-400 hover:text-gray-600 p-2"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 text-center">
              <div className="bg-white p-4 rounded-xl border-2 border-gray-200 inline-block mb-4">
                <QRCode
                  value={createQRData(selectedQrItem)}
                  size={200}
                  style={{ height: "200px", width: "200px" }}
                  viewBox="0 0 256 256"
                />
              </div>

              <div className="bg-gray-50 rounded-xl p-4 text-left">
                <h4 className="font-semibold text-gray-800 mb-3">Content</h4>
                <div className="text-lg font-mono bg-white p-3 rounded border break-all">
                  {selectedQrItem.textContent ||
                    selectedQrItem.PartNumber ||
                    selectedQrItem.partNumber ||
                    "No content"}
                </div>
                {!selectedQrItem.textContent && (
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Model:</span>
                      <span className="font-semibold">
                        {selectedQrItem.Model || selectedQrItem.model || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Serial Number:</span>
                      <span className="font-mono font-bold">
                        {selectedQrItem.SerialNo ||
                          selectedQrItem.serialNo ||
                          "Not assigned"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setSuccess(`QR Code downloaded!`);
                  setQrDialog(false);
                }}
                className="mt-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:shadow-lg transition-all duration-200 hover:-translate-y-1 flex items-center space-x-2 mx-auto"
              >
                <Download className="h-4 w-4" />
                <span>Download QR Code</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scanner Modal */}
      {scannerOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-2 rounded-lg">
                  <QrCode className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Quick Text Printer
                  </h3>
                  <p className="text-gray-600">
                    Enter any text for instant QR code printing
                  </p>
                </div>
              </div>
              <button
                onClick={() => setScannerOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-2"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="relative">
                <QrCode className="absolute left-3 top-3 h-6 w-6 text-gray-400" />
                <input
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="Enter any text to print as QR code..."
                  autoFocus
                  disabled={scanLoading}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleScanSubmit();
                    }
                  }}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
                />
              </div>

              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h4 className="font-medium text-blue-800 mb-2">How it works</h4>
                <div className="text-sm text-blue-700 space-y-1">
                  <p>
                    1. Enter any text (like "asfasvcsaxc", "Hello World", etc.)
                  </p>
                  <p>2. System will print the exact text as QR code</p>
                  <p>
                    3. 2 labels will be printed automatically (70mm x 15mm size)
                  </p>
                  <p>4. Entry will be saved to scan history</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setScannerOpen(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleScanSubmit}
                disabled={!scanInput.trim() || scanLoading}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-2 rounded-lg hover:shadow-lg transition-all duration-200 hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {scanLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <Printer className="h-5 w-5" />
                )}
                <span>{scanLoading ? "Processing..." : "Print as QR"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Dialog - Enhanced with Year/Month Override */}
      {printDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center space-x-3 p-6 border-b border-gray-200">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-lg">
                <Printer className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Label Print Configuration
                </h3>
                <p className="text-gray-600">
                  Configure your label settings and print
                </p>
              </div>
            </div>

            <div className="flex flex-1 min-h-0">
              {/* Left Side - Form Content */}
              <div className="flex-1 p-6 overflow-y-auto">
                {/* Year/Month Override Alert for December */}
                {checkDecemberOverride() && !selectedPrintItem?.textContent && (
                  <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                    <div className="flex items-start space-x-3">
                      <Calendar className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-yellow-800">
                          {new Date().getMonth() === 11
                            ? "December Override Available"
                            : "Custom Date Override"}
                        </h4>
                        <p className="text-yellow-700 mt-1">
                          {new Date().getMonth() === 11
                            ? "It's December! You can manually set the year and month for serial number generation."
                            : "You can manually override the year and month for serial number generation."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Print Quantity
                      </label>
                      <input
                        type="number"
                        value={printQuantity}
                        onChange={(e) =>
                          setPrintQuantity(
                            Math.max(1, parseInt(e.target.value) || 1)
                          )
                        }
                        min="1"
                        max="100"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {!selectedPrintItem?.textContent && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Serial Number
                        </label>
                        <input
                          type="text"
                          value={serialStartFrom}
                          onChange={(e) => setSerialStartFrom(e.target.value)}
                          placeholder="00001"
                          className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            !isManualSerialEntry
                              ? "bg-green-50 border-green-300"
                              : ""
                          }`}
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Label Size
                      </label>
                      <select
                        value={labelSize}
                        onChange={(e) => setLabelSize(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="70x15">
                          70mm × 15mm (2 copies per item)
                        </option>
                        <option value="100x50">
                          100mm × 50mm (1 copy per item)
                        </option>
                      </select>
                    </div>

                    {/* Custom Year Input */}
                    {!selectedPrintItem?.textContent && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Custom Year (YY)
                          <button
                            type="button"
                            onClick={() =>
                              setShowYearMonthOverride(!showYearMonthOverride)
                            }
                            className="ml-2 text-blue-600 hover:text-blue-800 text-xs"
                          >
                            {showYearMonthOverride ? "Hide" : "Show"}
                          </button>
                        </label>
                        <input
                          type="text"
                          value={customYear}
                          onChange={(e) =>
                            setCustomYear(e.target.value.slice(0, 2))
                          }
                          placeholder={new Date()
                            .getFullYear()
                            .toString()
                            .slice(-2)}
                          disabled={!showYearMonthOverride}
                          className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            !showYearMonthOverride ? "bg-gray-100" : ""
                          } ${
                            customYear ? "bg-yellow-50 border-yellow-300" : ""
                          }`}
                        />
                      </div>
                    )}

                    {/* Custom Month Input */}
                    {!selectedPrintItem?.textContent && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Custom Month (MM)
                        </label>
                        <select
                          value={customMonth}
                          onChange={(e) => setCustomMonth(e.target.value)}
                          disabled={!showYearMonthOverride}
                          className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            !showYearMonthOverride ? "bg-gray-100" : ""
                          } ${
                            customMonth ? "bg-yellow-50 border-yellow-300" : ""
                          }`}
                        >
                          <option value="">
                            {String(new Date().getMonth() + 1).padStart(2, "0")}{" "}
                            (Current)
                          </option>
                          <option value="01">01 (January)</option>
                          <option value="02">02 (February)</option>
                          <option value="03">03 (March)</option>
                          <option value="04">04 (April)</option>
                          <option value="05">05 (May)</option>
                          <option value="06">06 (June)</option>
                          <option value="07">07 (July)</option>
                          <option value="08">08 (August)</option>
                          <option value="09">09 (September)</option>
                          <option value="10">10 (October)</option>
                          <option value="11">11 (November)</option>
                          <option value="12">12 (December)</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Custom Date Warning */}
                  {(customYear || customMonth) &&
                    !selectedPrintItem?.textContent && (
                      <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                        <div className="flex items-start space-x-3">
                          <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-orange-800">
                              Custom Date Override Active
                            </h4>
                            <p className="text-orange-700 mt-1">
                              Serial numbers will use custom date:{" "}
                              {customYear ||
                                new Date().getFullYear().toString().slice(-2)}
                              /
                              {customMonth ||
                                String(new Date().getMonth() + 1).padStart(
                                  2,
                                  "0"
                                )}
                              <br />
                              <strong>Preview:</strong> {getPreviewSerialNo()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                  {selectedPrintItem?.textContent && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-yellow-800 text-sm">
                        <strong>Text Mode:</strong> This will print "
                        {selectedPrintItem.textContent}" as QR codes with{" "}
                        {printQuantity * (labelSize === "70x15" ? 2 : 1)} total
                        labels.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side - Label Preview */}
              <div className="w-1/2 min-w-[400px] border-l border-gray-200 p-6 bg-gray-50 flex flex-col justify-center overflow-y-auto">
                <h4 className="font-semibold text-gray-800 mb-4 text-center text-lg">
                  Label Preview ({labelSize}mm)
                </h4>

                <div className="flex justify-center items-center flex-1">
                  {labelSize === "70x15" ? (
                    <div className="w-80 h-20 border-2 border-gray-800 flex items-center bg-white p-2 shadow-lg">
                      {/* QR Code on Left */}
                      <div className="flex-shrink-0 mr-4">
                        <QRCode
                          value={
                            createQRData(selectedPrintItem) || "Sample Text"
                          }
                          size={60}
                          style={{ height: "60px", width: "60px" }}
                          viewBox={`0 0 256 256`}
                        />
                      </div>
                      {/* Content on Right */}
                      <div className="flex-1 flex flex-col justify-center items-center text-center">
                        <div className="font-bold text-lg font-mono">
                          {selectedPrintItem?.textContent ||
                            getPreviewSerialNo()}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-96 h-48 border-2 border-gray-800 flex bg-white p-3 shadow-lg">
                      {/* QR Code on Left */}
                      <div className="flex-shrink-0 mr-4 flex items-center">
                        <QRCode
                          value={
                            createQRData(selectedPrintItem) || "Sample Text"
                          }
                          size={140}
                          style={{ height: "140px", width: "140px" }}
                          viewBox={`0 0 256 256`}
                        />
                      </div>
                      {/* Details on Right */}
                      <div className="flex-1 flex flex-col justify-center text-left text-sm space-y-2">
                        <div className="font-bold text-md">
                          <strong>
                            Part no:
                            {selectedPrintItem?.textContent ||
                              selectedPrintItem?.PartNumber ||
                              selectedPrintItem?.partNumber ||
                              "SA0500F001"}
                          </strong>
                        </div>

                        {!selectedPrintItem?.textContent && (
                          <>
                            <div className="font-bold text-md">
                              <strong>
                                Model:{" "}
                                {selectedPrintItem?.Model ||
                                  selectedPrintItem?.model ||
                                  "Isam 550 Master"}
                              </strong>
                            </div>
                            <div className="font-bold text-md">
                              <strong>Location:</strong>{" "}
                              <strong>
                                {selectedPrintItem?.StorageLocation ||
                                  selectedPrintItem?.storageLocation ||
                                  "Not specified"}
                              </strong>
                            </div>
                            {(customYear || customMonth) && (
                              <div className="text-orange-700 text-xs">
                                <strong>Custom Date:</strong>{" "}
                                {customYear ||
                                  new Date().getFullYear().toString().slice(-2)}
                                /
                                {customMonth ||
                                  String(new Date().getMonth() + 1).padStart(
                                    2,
                                    "0"
                                  )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 flex-shrink-0 bg-white">
              <button
                onClick={() => {
                  setPrintDialog(false);
                  setCustomYear("");
                  setCustomMonth("");
                  setShowYearMonthOverride(false);
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executePrint}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-2 rounded-lg hover:shadow-lg transition-all duration-200 hover:-translate-y-1 flex items-center space-x-2"
              >
                <Printer className="h-5 w-5" />
                <span>
                  Print{" "}
                  {labelSize === "70x15" ? printQuantity * 2 : printQuantity}{" "}
                  Labels
                  {customYear || customMonth ? " (Custom Date)" : ""}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartsManagement;
