import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Routes, Route } from "react-router-dom";
import LoginPage from "./Login";
import "./index.css";
import App from "./App.tsx";

const mode = import.meta.env.MODE;
console.log("mode:", mode);

const AppRoute = () => {
  if (mode === "login") {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </BrowserRouter>
    );
  }
  if (mode === "development") {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/app" element={<App />} />
          <Route path="/app/login" element={<LoginPage />} />
        </Routes>
      </BrowserRouter>
    );
  }
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/app" element={<App />} />
      </Routes>
    </BrowserRouter>
  );
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRoute />
  </StrictMode>
);
