// const nodemailer = require("nodemailer");

// const sendEmailWithPDF = async (to, subject, pdfBuffer, chatbotName) => {
//   const transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//       user: process.env.EMAIL_USER,
//       pass: process.env.EMAIL_PASS,
//     },
//   });

//   await transporter.sendMail({
//     from: `"Troika Chatbot Reports" <${process.env.EMAIL_USER}>`,
//     to,
//     subject,
//     text: `Hi,\n\nAttached is your chatbot daily report for "${chatbotName}".`,
//     attachments: [
//       {
//         filename: `${chatbotName.replace(/\s+/g, "_")}_Report.pdf`,
//         content: pdfBuffer,
//       },
//     ],
//   });
// };

// module.exports = sendEmailWithPDF;
