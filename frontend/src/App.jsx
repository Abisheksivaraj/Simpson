import React from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import Footer from "./components/Footer"; // Fixed casing
import Login from "./components/Login"; // Fixed casing
import Models from "./components/AddModel";


// Create a separate component for the app content that uses useLocation
const AppContent = () => {
  const location = useLocation();
  const isAuthPage = location.pathname === "/";
  const isDashboard = location.pathname === "/dashboard";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      }}
    >
   

      {/* Main content area */}
      <div style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Login />} />
         <Route path="/models" element={<Models />} />
         
        </Routes>
      </div>

      {/* Show Footer for non-auth and non-dashboard pages */}
      {!isAuthPage && !isDashboard && (
        <div
          style={{
            
            bottom: 0,
            left: 0,
            width: "100%",
            backgroundColor: "white",
            zIndex: 1000,
          }}
        >
          <Footer />
        </div>
      )}
    </div>
  );
};

const App = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;


