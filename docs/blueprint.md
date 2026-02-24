# **App Name**: KCI Blood Donor

## Core Features:

- GitHub Authentication: Allow users to register using their GitHub accounts for secure access.
- Registration Form: Collect user data via a form with fields for full name, ID number, and WhatsApp number.
- Location and Date Selection: Allow users to choose a location and date for blood donation from a list of options, each with a limited quota.
- Quota Management: Real-time tracking of available slots, disabling options that have reached their quota, using Firestore to ensure consistency.
- Success Notification: Display a 'Registration Successful' notification upon successful registration.
- WhatsApp Confirmation: Send an automated WhatsApp message to the user confirming their registration details, including name, location, and date, using a tool to conditionally select appropriate location details to include in the message.
- Data Export: Enable admins to download registration data in Excel format for record-keeping and analysis.

## Style Guidelines:

- Primary color: Deep scarlet (#941B0C) to symbolize blood donation and passion.
- Background color: Soft beige (#F2E8D5) for a clean and calming effect.
- Accent color: Dusty rose (#C9ADA7) to complement the primary color.
- Body and headline font: 'PT Sans', a humanist sans-serif.
- Use flat, modern icons related to blood donation and locations, such as blood drop icons and map markers.
- Clean and intuitive layout with clear sections for registration, location selection, and confirmation.
- Subtle animations for form transitions and quota updates.