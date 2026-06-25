import "./App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./lib/auth";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

import Home from "./pages/Home";
import FlightSearch from "./pages/FlightSearch";
import SeatSelection from "./pages/SeatSelection";
import Billing from "./pages/Billing";
import Payment from "./pages/Payment";
import BookingConfirmation from "./pages/BookingConfirmation";
import Track from "./pages/Track";
import CheckIn from "./pages/CheckIn";
import Offers from "./pages/Offers";
import Destinations from "./pages/Destinations";
import Fleet from "./pages/Fleet";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Careers from "./pages/Careers";
import Login from "./pages/Login";
import Register from "./pages/Register";
import CustomerDashboard from "./pages/CustomerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import PilotDashboard from "./pages/PilotDashboard";
import CrewDashboard from "./pages/CrewDashboard";

function PrivateRoute({ children, roles }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function Shell() {
  const loc = useLocation();
  const hideShell = loc.pathname === "/login" || loc.pathname === "/register";
  return (
    <>
      {!hideShell && <Navbar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<FlightSearch />} />
        <Route path="/seats/:flightId" element={<SeatSelection />} />
        <Route path="/billing/:flightId" element={<PrivateRoute><Billing /></PrivateRoute>} />
        <Route path="/payment/:bookingId" element={<PrivateRoute><Payment /></PrivateRoute>} />
        <Route path="/booking/:bookingId" element={<PrivateRoute><BookingConfirmation /></PrivateRoute>} />
        <Route path="/track" element={<Track />} />
        <Route path="/checkin" element={<CheckIn />} />
        <Route path="/offers" element={<Offers />} />
        <Route path="/destinations" element={<Destinations />} />
        <Route path="/fleet" element={<Fleet />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/careers" element={<Careers />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/account" element={<PrivateRoute roles={["customer", "admin"]}><CustomerDashboard /></PrivateRoute>} />
        <Route path="/admin" element={<PrivateRoute roles={["admin"]}><AdminDashboard /></PrivateRoute>} />
        <Route path="/pilot" element={<PrivateRoute roles={["pilot", "admin"]}><PilotDashboard /></PrivateRoute>} />
        <Route path="/crew" element={<PrivateRoute roles={["crew", "admin"]}><CrewDashboard /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!hideShell && <Footer />}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Shell />
        <Toaster position="top-right" theme="dark" />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
