# KinetixLab 🏃‍♂️

**Advanced AI-powered biomechanics analysis suite for Singapore PE education & sports performance.**

KinetixLab leverages Google's Gemini 2.0 AI and Computer Vision (MediaPipe) to provide professional-grade movement analysis. It supports single and dual-camera workflows to decompose complex movements into actionable feedback, aligned with biomechanical principles and MOE PE standards.

---

## ✨ Key Features

### 🎥 Multi-View Analysis
-   **Dual-Angle Support:** Synchronize **Front** and **Side** views for a complete 3D analysis of movement (e.g., assessing knee valgus from the front while checking spinal neutrality from the side).
-   **Single View Mode:** Rapid analysis for quick checks.

### 🤖 Generative AI Feedback
-   **Gemini 2.0 Integration:** Utilizes the latest Vision-Language Models to "see" and "reason" about movement.
-   **Frame-by-Frame Citations:** The AI explicitly cites evidence (e.g., *"Side View, Frame 5: Lumbar hyperextension observed during overhead press"*).
-   **Phase Detection:** Automatically identifies movement phases (Setup, Descent, Apex, Ascent, Landing).

### 📊 Professional Tools
-   **Visual Evidence Appendix:** Auto-generated visual galleries linking specific keyframes to AI feedback.
-   **PDF Reports:** Professional-grade PDF exports with smart pagination and full-width visual evidence appendices.
-   **Frame Export:** Download the exact high-res keyframes used in the analysis as a ZIP file.
-   **Smart Search:** Automatically scans videos to find the "Peak" action (e.g., maximum height in a jump or max depth in a squat).

### 🛡️ Hybrid Storage
-   **Cloud & Local Sync:** Seamlessly saves analysis history to Supabase (Cloud) when online, and falls back to Local Storage when offline.
-   **History Tracking:** Review past analyses to track student progress over time.

---

## 🎯 Supported Workflows

-   **Weightlifting:** Squats, Deadlifts, Overhead Press
-   **Gymnastics:** Handstands, Cartwheels, Rolls
-   **Athletics:** Sprints, Throws (Shot Put, Discus), Jumps
-   **Ball Sports:** Shooting mechanics (Basketball, Netball), Kicking (Soccer)

---

## 🚀 Quick Start

1.  **Select Mode:** Choose **Single View** or **Dual View** (Recommended).
2.  **Upload Video:** Drag & drop movement videos.
3.  **Configure:** 
    -   *Skill Name:* (Optional) E.g., "Handstand".
    -   *Frame Count:* Default is **10** for Dual View (customizable).
4.  **Analyze:** Click "Analyze Movement". The AI will extract keyframes and generate a report.
5.  **Export:** Save as PDF or download raw frames.

---

## 💻 Tech Stack

-   **Frontend:** React 19, TypeScript, Vite
-   **Styling:** Tailwind CSS, Lucide Icons
-   **AI & Vision:** 
    -   Google Gemini 2.0 Flash / Pro (via API)
    -   MediaPipe Pose (Real-time skeleton tracking)
-   **Data Visualization:** Recharts
-   **PDF Generation:** jsPDF, html2canvas
-   **Backend / Storage:** Supabase (PostgreSQL), LocalStorage API


---

## 🎓 Target Audience

-   **PE Teachers:** Objective assessment for Susi / NAPFA / Core PE.
-   **Student Athletes:** Self-directed learning and technique refinement.
-   **Coaches:** High-performance biomechanics breakdown.

---

**Built for Singapore PE Education** 🇸🇬
