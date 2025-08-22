Smart Tab manager

Description:

As developers, we often keep many browser tabs open for references, documentation, or tools. Over time, this becomes overwhelming, and we may forget or feel lazy about closing tabs that are no longer needed.

Smart Tab Manager is a Google Chrome extension designed to help manage browser tabs automatically. It monitors user activity — including keyboard presses, mouse clicks, and scroll behavior — and evaluates which tabs are actively used and which are idle.

The extension then recommends tabs to close by showing an intuitive popup, helping users keep their browser clean and focused, without losing important references. Tabs that have no activity (no scrolling, clicking, or typing) are considered less important and suggested for closure.

Methodology

Smart Tab Manager is designed to intelligently manage browser tabs by monitoring user activity and recommending which tabs to keep or close. It consists of two main components: a backend and a Chrome extension.

1. Chrome Extension (Frontend)

The extension/ folder contains the Chrome extension that runs on the client side. It is responsible for:

Tracking user interactions on each tab:

Mouse clicks

Keyboard inputs

Scroll depth

Active and idle time

Calculating tab activity metrics in real-time.

Displaying popup notifications to recommend closing unused tabs.

Sending activity data to the backend (if used) for further analysis and scoring.

Note: For installing the extension in Chrome, only the extension/ folder is required. The backend is optional if you want to integrate server-side analytics or persistent storage.

2. Backend (Optional)

The backend/ folder contains a Java-based Spring Boot project. Its responsibilities include:

Receiving tab activity data from the extension via an API.

Calculating tab scores using custom logic: combining active time, clicks, key presses, scroll depth, and idle time.

Storing historical tab activity for analytics or future recommendations.

Exposing APIs for the extension to fetch past recommendations or tab statistics.

3. Data Structures & Algorithms

Heap (Min-Heap): The backend or extension uses a min-heap to efficiently track the least active tabs and prioritize them for closure.

Scoring Algorithm:

Active time × 0.5

Clicks × 0.3

Key presses × 0.2

Scroll depth × 0.1

Idle time × -0.5

Tabs are then classified as:

Keep (high score)

Consider (medium score)

Close (low score)

4. API Usage

The Chrome extension can send POST requests to the backend with tab activity data.

The backend can respond with tab recommendations or historical statistics via REST APIs.

Example endpoints (backend):

POST /api/tabActivity – send current tab activity data

GET /api/recommendation/{tabId} – fetch recommendation for a specific tab

