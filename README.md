# Delivery Label Generator

A web application that allows users to log in and generate printable delivery labels with barcodes in PDF format.

## Features

- User authentication with secure password hashing
- Intuitive form for entering sender and recipient details
- Automatic generation of unique delivery IDs
- Barcode generation for each delivery
- Downloadable PDF labels with all necessary information
- Session management with express-session
- Generate PDF delivery labels with unique barcodes
- Clean, responsive UI built with Tailwind CSS
- No database required (in-memory user store for demo purposes)

## Prerequisites

- Node.js 
- npm 
- git 

## Installation

1. Clone the repository or download the source code

```bash
git clone https://github.com/GritHri/label-generator.git
```

2. Navigate to the project directory

```bash
cd label-generator
```

3. Install dependencies:

```bash
npm install
```

## Configuration

The application uses environment variables for configuration. Create a `.env` file in the root directory with the contents of **.env.example**. This step is not mandatory as there exist fallback for every import, but it is recommended to set the environment variables for production.

## Running the Application

### Development Mode

```bash
npm run dev
```

This will start the server with nodemon for automatic reloading. Any changes made to the code will hot reload.

### Production Mode

```bash
npm start
```

The application will be available at `http://localhost:3000`

## Default Credentials

- **Username:** test
- **Password:** test123

## Project Structure

```
/
├── public/               # Static files
│   └── barcodes/         # Temporary barcode images
├── views/                # EJS templates
│   ├── dashboard.ejs     # Dashboard page
│   └── login.ejs         # Login page
├── index.js              # Main application file
├── package.json          # Project dependencies
└── README.md             # This file
```

## Dependencies

- express: Web framework
- ejs: Templating engine
- bcryptjs: Password hashing
- express-session: Session management
- pdfkit: PDF generation
- bwip-js: Barcode generation
- dotenv: Environment variable management

## Softskills Analysis

https://github.com/GritHri/label-generator/issues/1
