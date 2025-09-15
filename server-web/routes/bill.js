// routes/bill.js  (ENHANCED VERSION with professional styling)
const express = require('express');
const fs = require('fs');
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const router = express.Router();

const { jsPDF } = require('jspdf');
const { default: autoTable } = require('jspdf-autotable');

// Helper: generate invoice PDF with professional styling
async function generateInvoicePDF(order) {
  // Khởi tạo A5 portrait (148 x 210 mm)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });

  // Load font Unicode for Vietnamese
  try {
    const fontPath = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
    const fontData = fs.readFileSync(fontPath).toString('base64');
    doc.addFileToVFS('DejaVuSans.ttf', fontData);
    doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
    doc.setFont('DejaVuSans', 'normal');
  } catch (e) {
    // fallback: default font
    console.warn('DejaVu font not found — using default font');
  }

  // Color scheme
  const primaryColor = [41, 77, 131]; // dark blue
  const headerBg = [235, 241, 255];    // light blue

  // Layout calculations
  const pageWidth = doc.internal.pageSize.getWidth();   // 148 mm
  const tableWidth = 10 + 50 + 15 + 10 + 20 + 25; // Total column widths
  const marginLeft = (pageWidth - tableWidth) / 2;
  const infoX = marginLeft;

  // Header title
  doc.setTextColor(...primaryColor);
  doc.setFontSize(10);
  doc.text('HÓA ĐƠN BÁN HÀNG', pageWidth / 2, 12, null, null, 'center');

  // Company information (left side)
  doc.setFontSize(7);
  doc.setTextColor(0);
  doc.text('SMART-SUPERMARKET', infoX, 22);
  doc.text('MST: 0303841523', infoX, 27);
  doc.text('Địa chỉ: 268 Lý Thường Kiệt, P.14, Q.10, TP.HCM', infoX, 32);

  // Invoice info (right side)
  const created = new Date(order.createdAt);
  const dd = String(created.getDate()).padStart(2, '0');
  const mm = String(created.getMonth() + 1).padStart(2, '0');
  const yyyy = created.getFullYear();
  const hh = String(created.getHours()).padStart(2, '0');
  const mi = String(created.getMinutes()).padStart(2, '0');
  const ss = String(created.getSeconds()).padStart(2, '0');
  doc.setFontSize(7);
  doc.text(`Số: ${order._id}`, pageWidth - infoX, 22, null, null, 'right');
  doc.text(`Ký hiệu: ${order.serial || '---'}`, pageWidth - infoX, 27, null, null, 'right');
  doc.text(`Thời gian: ${hh}:${mi}:${ss}, ${dd}/${mm}/${yyyy}`, pageWidth - infoX, 32, null, null, 'right');

  // Separator line
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.4);
  doc.line(infoX, 36, infoX + tableWidth, 36);

  // Customer information
  doc.setFontSize(7);
  doc.setTextColor(0);
  doc.text('Người mua:', infoX, 41);
  doc.text(`Họ tên: ${order.user?.fullName || order.user?.email || 'Khách vãng lai'}`, infoX, 45);
  doc.text(`MST: ${order.user?.taxCode || '---'}`, infoX, 49);
  doc.text(`Địa chỉ: ${order.user?.address || '---'}`, infoX, 53);

  // Table headers
  const headers = ['STT', 'Tên hàng', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền'];

  // Build table body with enhanced product info
  const body = (order.items || []).map((it, i) => {
    // Get product name safely
    let productName = null;
    if (it.product && typeof it.product === 'object' && it.product.name) {
      productName = String(it.product.name);
    }

    // Prefer item.name (frontend-provided). Fallback to productName or 'Unknown'.
    const baseName = (it.name && String(it.name)) || productName || 'Unknown';

    // Enhanced name with additional info
    let displayName = baseName;
    
    // Add weight info for weighted items
    if (it.isWeighted && it.weightGrams) {
      displayName += ` — ${it.weightGrams} g`;
    }
    
    // Add PLU code if available
    if (it.pluCode) {
      displayName += ` (PLU: ${it.pluCode})`;
    }
    
    // Add rawId if available and different from pluCode
    if (it.rawId && it.rawId !== it.pluCode) {
      displayName += ` [${it.rawId}]`;
    }

    // Unit determination
    const unit = it.isWeighted ? 'g' : (it.unit ? String(it.unit) : 'Cái');

    const qty = Number(it.quantity || 1);
    const price = Number(it.price || 0);
    const lineTotal = price * qty;

    return [
      i + 1,
      displayName,
      unit,
      qty,
      price.toLocaleString('vi-VN'),
      lineTotal.toLocaleString('vi-VN')
    ];
  });

  // Generate table with professional styling
  autoTable(doc, {
    startY: 58,
    head: [headers],
    body,
    theme: 'grid',
    headStyles: {
      fillColor: headerBg,
      textColor: primaryColor,
      font: 'DejaVuSans',
      fontStyle: 'normal',
      halign: 'center',
      fontSize: 7
    },
    styles: {
      font: 'DejaVuSans',
      fontStyle: 'normal',
      fontSize: 7,
      cellPadding: 2,
      textColor: 0,
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 10 },                    // STT
      1: { cellWidth: 50, halign: 'left' },    // Tên hàng
      2: { cellWidth: 15 },                    // ĐVT
      3: { cellWidth: 10 },                    // SL
      4: { cellWidth: 20, halign: 'right' },   // Đơn giá
      5: { cellWidth: 25, halign: 'right' }    // Thành tiền
    },
    margin: { left: marginLeft, right: marginLeft }
  });

  // Total amount
  const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY ? doc.lastAutoTable.finalY : 90) + 6;
  doc.setFontSize(7);
  doc.setTextColor(...primaryColor);
  doc.text(
    `Tổng cộng: ${Number(order.total || 0).toLocaleString('vi-VN')}₫`, 
    infoX + tableWidth, 
    finalY, 
    null, 
    null, 
    'right'
  );

  // Signature section
  doc.setFontSize(7);
  doc.setTextColor(0);
  doc.text('Người mua', infoX + 5, finalY + 20);
  doc.text('Người bán', infoX + tableWidth - 20, finalY + 20);
  doc.text('(Ký, ghi rõ họ tên)', infoX + tableWidth - 20, finalY + 24);

  return Buffer.from(doc.output('arraybuffer'));
}

// Debug route: return raw order JSON and log items
router.get('/:id/raw', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user').populate('items.product');
    if (!order) return res.status(404).json({ message: 'Đơn hàng không tồn tại' });

    console.log('--- DEBUG: order.items for', req.params.id, '---');
    order.items.forEach((it, idx) => {
      console.log(`#${idx+1}`, {
        rawId: it.rawId,
        pluCode: it.pluCode,
        name: it.name,
        isWeighted: it.isWeighted,
        weightGrams: it.weightGrams,
        productPresent: (it.product && typeof it.product === 'object'),
        productValue: it.product,
        price: it.price,
        quantity: it.quantity
      });
    });
    console.log('--- END DEBUG ---');

    return res.json(order);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Lỗi server' });
  }
});

// Enhanced Invoice (PDF) route with professional styling
router.get('/:id/invoice', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user').populate('items.product');
    if (!order) return res.status(404).send('Đơn hàng không tồn tại');

    // Debug logs
    console.log('Generating enhanced invoice for order:', req.params.id);
    console.log('Items count =', (order.items || []).length);
    order.items.forEach((it, idx) => {
      console.log(`#${idx+1}`, {
        name: it.name,
        rawId: it.rawId,
        pluCode: it.pluCode,
        isWeighted: it.isWeighted,
        weightGrams: it.weightGrams,
        price: it.price,
        quantity: it.quantity,
        productType: typeof it.product,
        productValue: it.product
      });
    });

    const pdfBuf = await generateInvoicePDF(order);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice_${req.params.id}.pdf"`
    });
    res.send(pdfBuf);
  } catch (e) {
    console.error('Enhanced invoice error:', e);
    res.status(500).send('Lỗi khi tạo hóa đơn');
  }
});

module.exports = router;