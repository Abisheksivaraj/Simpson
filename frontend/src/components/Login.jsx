import React, { useState } from "react";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import bg from "../assets/bg.jpg";

// Import your API configuration
import { api } from "../components/apiConfig";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [focusedField, setFocusedField] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Clear error when user starts typing
    if (error) setError("");
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async () => {
    // Enhanced validation
    if (!formData.email || !formData.password) {
      setError("Please fill in all fields");
      return;
    }

    if (!validateEmail(formData.email)) {
      setError("Please enter a valid email address");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.post("/api/auth/login", {
        email: formData.email,
        password: formData.password,
      });

      let data;
      if (response.data) {
        // If using axios-like wrapper
        data = response.data;
      } else if (response.json) {
        // If using fetch-like wrapper
        data = await response.json();
      } else {
        // If response is already the data
        data = response;
      }

      // Check for success - adapt this based on your API response structure
      if (response.status === 200 || response.ok || data.success) {
        // Store token and user data
        if (typeof Storage !== "undefined") {
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user));
        }

        setSuccess(
          `Welcome back, ${data.user?.userName || data.user?.name || "User"}!`
        );

        // Force both Admin and regular users to go to /models page
        setTimeout(() => {
          // Use window.location.replace to prevent back button issues
          window.location.replace("/models");
        }, 1500);
      } else {
        setError(data.message || "Login failed. Please try again.");
      }
    } catch (error) {
      console.error("Login error:", error);

      // More specific error handling
      if (error.response) {
        // Server responded with error status
        const errorData = error.response.data;
        setError(
          errorData.message || "Login failed. Please check your credentials."
        );
      } else if (error.request) {
        // Network error
        setError("Network error. Please check your connection and try again.");
      } else {
        // Other error
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !loading) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleForgotPassword = () => {
    // Add proper navigation or modal logic here
    console.log("Navigate to forgot password page");
    // window.location.href = "/forgot-password";
  };

  const handleSignUp = () => {
    // Add proper navigation logic here
    console.log("Navigate to register page");
    window.location.href = "/register";
  };

  return (
    <div className="min-h-screen relative flex">
      {/* Background Image - Full Page */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${bg})`,
        }}
        aria-hidden="true"
      />

      {/* Login Card - Right Side */}
      <div className="relative z-10 w-full flex justify-end items-center pr-8 md:pr-16 lg:pr-24">
        <div className="opacity-90 bg-white rounded-lg shadow-xl p-8 w-[30rem] border-0 backdrop-blur-sm">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Login</h1>
            <p className="text-gray-600 text-sm">
              Please sign in to your account
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div
              className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2"
              role="alert"
            >
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="text-green-700 text-sm">{success}</span>
            </div>
          )}

          {/* Login Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="space-y-6"
          >
            {/* Email Field - MUI Outlined Style */}
            <div className="relative">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                onKeyPress={handleKeyPress}
                disabled={loading}
                className={`w-full px-4 py-4 border-2 rounded-md outline-none transition-all duration-200 bg-white text-gray-800 peer ${
                  focusedField === "email" || formData.email
                    ? "border-black pt-6 pb-2"
                    : "border-gray-300 hover:border-gray-400"
                } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                placeholder=" "
                autoComplete="email"
                required
                aria-label="Email address"
              />
              <label
                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  focusedField === "email" || formData.email
                    ? "top-2 text-xs text-blue-500 font-medium"
                    : "top-4 text-base text-gray-500"
                }`}
              >
                Enter Email
              </label>
              <Mail
                className={`absolute right-3 top-4 w-5 h-5 transition-colors duration-200 ${
                  focusedField === "email" ? "text-blue-500" : "text-gray-400"
                }`}
              />
            </div>

            {/* Password Field - MUI Outlined Style */}
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
                onKeyPress={handleKeyPress}
                disabled={loading}
                className={`w-full px-4 py-4 pr-20 border-2 rounded-md outline-none transition-all duration-200 bg-white text-gray-800 peer ${
                  focusedField === "password" || formData.password
                    ? "border-black pt-6 pb-2"
                    : "border-gray-300 hover:border-gray-400"
                } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                placeholder=" "
                autoComplete="current-password"
                required
                minLength={6}
                aria-label="Password"
              />
              <label
                className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  focusedField === "password" || formData.password
                    ? "top-2 text-xs text-blue-500 font-medium"
                    : "top-4 text-base text-gray-500"
                }`}
              >
                Password
              </label>

              <button
                type="button"
                onClick={togglePasswordVisibility}
                disabled={loading}
                className={`absolute right-3 top-4 text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1 rounded-full hover:bg-gray-100 ${
                  loading ? "cursor-not-allowed opacity-50" : ""
                }`}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading || !formData.email || !formData.password}
              className={`w-full py-3 px-6 rounded-md font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98] uppercase text-sm tracking-wide ${
                loading || !formData.email || !formData.password
                  ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                  : "bg-black hover:bg-gray-800 active:bg-gray-900 text-white"
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Signing In...
                </div>
              ) : (
                "Login"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
