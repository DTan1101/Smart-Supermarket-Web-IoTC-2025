const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const pluController = require('../controllers/pluController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Tuyến cho sản phẩm barcode
router.get('/', productController.getAllProducts);
router.post('/', [auth, admin], productController.createProduct);
router.put('/:id', [auth, admin], productController.updateProduct);
router.delete('/:id', [auth, admin], productController.deleteProduct);

// Tuyến cho sản phẩm PLU
router.get('/plu', [auth, admin], pluController.getAllPLUProducts);
router.post('/plu', [auth, admin], pluController.createPLUProduct);
router.put('/plu/:id', [auth, admin], pluController.updatePLUProduct);
router.delete('/plu/:id', [auth, admin], pluController.deletePLUProduct);

module.exports = router;