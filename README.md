# CampusFind – Lost and Found MRDU

CampusFind is a web-based lost and found platform designed for students at MRDU. It helps students report lost or found items and search for items posted by other students.

The main goal of this project is to make it easier for students to reconnect lost items with their owners.

## Live Project

Frontend: https://lost-and-found-mrdu.onrender.com

Backend: https://lost-and-found-mrdu-backend.onrender.com/api/health

## Features

- User registration and login
- JWT-based authentication
- Post lost item reports
- Post found item reports
- Add item details and location
- Search and filter reports
- View individual reports
- Mark items as recovered
- View reports created by the logged-in user
- Campus location selection
- Google Maps integration

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS

### Backend

- Node.js
- Express.js
- TypeScript
- Prisma ORM

### Database

- PostgreSQL

## Project Structure

```text
CampusFind
│
├── frontend
│   └── React frontend application
│
├── backend
│   ├── API and authentication
│   ├── Report management
│   └── Database integration
│
└── README.md
How It Works
A user creates an account and logs in.
The user can post a lost or found item.
Item details and location are added to the report.
Other users can search and view posted reports.
Once an item is returned to its owner, the report can be marked as recovered.
Project Status

This project is currently deployed and functional.

Some features and integrations are still being improved as the project continues to develop.

Future Improvements
Real-time notifications
Better matching between lost and found items
Chat between users
Improved location features
Image upload improvements
Enhanced search and filtering
Email notifications
Author

Pasula Roopa Reddy

GitHub: https://github.com/pasularoopareddy
