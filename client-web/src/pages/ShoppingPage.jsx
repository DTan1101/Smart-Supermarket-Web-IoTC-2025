import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { 
  Box, Grid, Typography, Button, TextField, Paper, IconButton, List, ListItem, 
  ListItemText, Divider, Badge, Alert, Snackbar, Modal, Fade, Backdrop, Container, Fab, Collapse, InputAdornment, Menu, MenuItem,
  Tabs, Tab, ButtonGroup, useTheme, useMediaQuery, CircularProgress
} from '@mui/material';
import { 
  ShoppingCart as CartIcon, 
  QrCodeScanner as ScannerIcon, 
  Delete as DeleteIcon, 
  Add as AddIcon, 
  Remove as RemoveIcon, 
  Close as CloseIcon, 
  Print as PrintIcon,
  Chat as ChatIcon,
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
  MoreVert as MoreVertIcon,
  DeleteSweep as ClearHistoryIcon,
  Scale as ScaleIcon
} from '@mui/icons-material';
import axios from 'axios';

// Thêm vào đầu file ShoppingPage.jsx
const FLASK_API = process.env.REACT_APP_FLASK_API;
const NGROK_URL = process.env.REACT_APP_NGROK_URL;
const MOMO_SERVER = process.env.REACT_APP_MOMO_SERVER;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ShoppingPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const scaleFactor = isMobile ? 0.85 : isTablet ? 0.95 : 1;
  
  const { currentUser } = useAuth();
  const { cart, addToCart, removeFromCart, updateQuantity, clearCart } = useCart();
  const [barcodeInput, setBarcodeInput] = useState('');
  const [inputMode, setInputMode] = useState('barcode');
  const [products, setProducts] = useState([]);
  const [lastRemoteBarcode, setLastRemoteBarcode] = useState(null);
  const [lastProcessedTs, setLastProcessedTs] = useState(null);
  const isResetRef = useRef(false);
  const lastTsRef = useRef(null);  
  const pollingCancelRef = useRef(false);

  const productsRef = useRef(products);
  const cartRef = useRef(cart);
  const addToCartRef = useRef(addToCart);
  const updateQuantityRef = useRef(updateQuantity);

  const [isScanning, setIsScanning] = useState(false);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [openPaymentModal, setOpenPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      text: "Xin chào! Tôi là trợ lý ảo của siêu thị.",
      isBot: true,
      timestamp: new Date()
    }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [chatMenuAnchor, setChatMenuAnchor] = useState(null);
  const [pluInput, setPluInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [isGettingWeight, setIsGettingWeight] = useState(false);
  const [lastWeighResult, setLastWeighResult] = useState(null);  
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('CASH');

  // Chat streaming control
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const chatAbortRef = useRef(null);

  const scaled = (value) => value * scaleFactor;
  
  const fontSize = {
    title: scaled(1.0),
    subtitle: scaled(0.9),
    body: scaled(0.8),
    caption: scaled(0.7),
    button: scaled(0.75),
    input: scaled(0.9)
  };

  const spacing = {
    small: scaled(0.5),
    medium: scaled(1),
    large: scaled(1.5)
  };

  const sizes = {
    buttonHeight: scaled(35),
    inputHeight: scaled(40),
    icon: scaled(20)
  };

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const resProducts = await axios.get(`${BACKEND_URL}/api/products`)
        console.log('Products from API:', resProducts);
        setProducts(
          resProducts.data
        );
        console.log('Products from API:', resProducts.data);
      
      } catch (err) {
        console.error('Failed to fetch products', err);
        showSnackbar('Không thể tải danh sách sản phẩm', 'error');
      }
    };
  
    fetchProducts();
  }, []);

  const getWeightFromPi = async () => {
    if (!pluInput) {
      showSnackbar('Vui lòng nhập mã PLU trước', 'warning');
      return;
    }
  
    setIsGettingWeight(true);
    try {
      const productRes = await axios.get(`${BACKEND_URL}/api/plus/plu/${pluInput}`);
      console.log(productRes.data);
      const product = productRes.data;
    
      const res = await axios.post(`${NGROK_URL}/start-weigh`, { plu: pluInput });
    
      const data = res.data;
      setLastWeighResult(data);
      setWeightInput(data.weight.toString());
    
      showSnackbar(
        `${product.name}: ${data.weight}kg - ${(product.pricePerKg * data.weight).toLocaleString()}₫`, 
        'success'
      );
    } catch (err) {
      showSnackbar('Không thể lấy dữ liệu từ thiết bị cân', 'error');
      console.error('Lỗi khi lấy cân nặng:', err);
    } finally {
      setIsGettingWeight(false);
    }
  };
  
  // keep refs updated
  useEffect(() => { productsRef.current = products; }, [products]);
  useEffect(() => { cartRef.current = cart; }, [cart]);
  useEffect(() => { addToCartRef.current = addToCart; }, [addToCart]);
  useEffect(() => { updateQuantityRef.current = updateQuantity; }, [updateQuantity]);

  useEffect(() => {
    pollingCancelRef.current = false;
    const url = `${NGROK_URL}/last-barcode`;
    console.debug('Start polling last-barcode ->', url);

    let intervalId = null;
    let isFirstPoll = true; // Đánh dấu lần poll đầu tiên

    const pollOnce = async () => {
      try {
        const res = await axios.get(url, { 
          timeout: 5000, 
          headers: { 
            Accept: 'application/json',
            'ngrok-skip-browser-warning': 'true'
          }
        });
        
        console.debug('[Polling] HTTP', res.status, res.statusText);
        console.debug('[Polling] Raw API data:', res.data);

        const doc = res?.data || {};
        const barcode = doc?.barcode != null ? String(doc.barcode).trim() : '';
        const ts = doc?.ts ?? null;

        if (!barcode || !ts) {
          console.debug('[Polling] No barcode or timestamp, skipping');
          return;
        }

        // Lần đầu tiên poll: chỉ cập nhật timestamp mà không xử lý barcode
        if (isFirstPoll) {
          console.log('[Polling] First poll - initializing timestamp:', ts);
          lastTsRef.current = ts;
          isFirstPoll = false;
          return; // Không xử lý barcode này vì có thể là data cũ
        }

        // Kiểm tra nếu vừa reset
        if (isResetRef.current) {
          console.log('[Polling] Just reset - updating lastTs to current:', ts);
          lastTsRef.current = ts;
          isResetRef.current = false;
          return;
        }

        // So sánh timestamp để tránh xử lý lại
        if (ts !== lastTsRef.current) {
          console.info('[Polling] New barcode event:', barcode, 'ts:', ts);

          // Cập nhật UI
          setBarcodeInput(barcode);
          setLastRemoteBarcode(barcode);
          lastTsRef.current = ts;

          // Xử lý thêm vào giỏ hàng
          setTimeout(() => {
            console.log('[Process] Adding barcode to cart:', barcode);
            const productsNow = productsRef.current || [];
            
            if (!Array.isArray(productsNow) || productsNow.length === 0) {
              showSnackbar(`Đã quét barcode: ${barcode} (chưa tải được sản phẩm)`, 'info');
              return;
            }

            const product = productsNow.find(p => String(p?.barcode ?? '').trim() === barcode);
            
            if (product) {
              const inCart = (cartRef.current || []).find(it => it._id === product._id);
              if (inCart) {
                updateQuantityRef.current(product._id, 1);
                showSnackbar(`Đã tăng số lượng ${product.name} (từ Pi)`, 'success');
              } else {
                addToCartRef.current(product);
                showSnackbar(`Đã thêm ${product.name} (từ Pi)`, 'success');
              }
            } else {
              showSnackbar(`Barcode ${barcode} không tìm thấy sản phẩm`, 'warning');
              console.warn('Available barcodes:', productsNow.map(p => p.barcode));
            }
          }, 100);
        } else {
          console.debug('[Polling] Same timestamp, skipping processing');
        }
      } catch (err) {
        if (err.response) {
          console.error('[Polling] Response error:', err.response.status, err.response.data);
        } else if (err.code === 'ECONNABORTED') {
          console.warn('[Polling] Request timeout');
        } else {
          console.error('[Polling] Request error:', err.message || err);
        }
      }
    };

    pollOnce();
    intervalId = setInterval(() => {
      if (!pollingCancelRef.current) {
        pollOnce();
      }
    }, 1000);

    return () => {
      pollingCancelRef.current = true;
      if (intervalId) clearInterval(intervalId);
      console.debug('Stopped polling last-barcode');
    };
  }, []);

  const handlePluAdd = async () => {
    if (!pluInput) {
      showSnackbar('Vui lòng nhập mã PLU', 'warning');
      return;
    }

    try {
      const response = await axios.get(`${BACKEND_URL}/api/plus/plu/${pluInput}`);
      const product = response.data;

      if (!weightInput) {
        showSnackbar('Vui lòng lấy cân nặng trước', 'warning');
        return;
      }

      // weightInput đã là kg từ Pi
      const weightKg = parseFloat(weightInput);
      if (Number.isNaN(weightKg) || weightKg <= 0) {
        showSnackbar('Cân nặng không hợp lệ', 'error');
        return;
      }

      // Convert kg sang gram để hiển thị
      const weightGrams = weightKg * 1000;
      
      // Tính giá dựa trên pricePerKg (giá trên 1000g = 1kg)
      // product.pricePerKg là giá VNĐ cho 1kg (1000 gram)
      const rawPrice = (Number(product.pricePerKg) || 0) * weightKg;
      const totalPrice = Math.round(rawPrice); // làm tròn thành integer VNĐ

      // Đảm bảo có id
      const id = product._id ?? product.id ?? product.productId ?? `plu-${pluInput}`;

      const weightedProduct = {
        ...product,
        _id: id,
        name: product.name ?? product.title ?? `PLU ${pluInput}`,
        weightGrams, // gram để hiển thị
        weightKg,    // kg để tính toán
        price: totalPrice, // giá cuối cùng cho sản phẩm này
        pricePerKg: product.pricePerKg, // giá gốc trên 1kg
        isWeighted: true,
        quantity: 1
      };

      addToCart(weightedProduct);
      showSnackbar(
        `Đã thêm ${weightedProduct.name} — ${weightGrams} g — ${totalPrice.toLocaleString()}₫`, 
        'success'
      );

      setPluInput('');
      setWeightInput('');
      setLastWeighResult(null);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        showSnackbar('Không tìm thấy sản phẩm với mã PLU này', 'error');
      } else {
        showSnackbar('Lỗi khi tra cứu sản phẩm', 'error');
        console.error('Lỗi tra cứu PLU:', error, error.response?.data || error.message);
      }
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setOpenSnackbar(true);
  };

  const handleCloseSnackbar = () => {
    setOpenSnackbar(false);
  };

  const simulateScan = () => {
    if (isScanning && products.length > 0) {
      const randomIndex = Math.floor(Math.random() * products.length);
      const randomProduct = products[randomIndex];
      addToCart(randomProduct);
      showSnackbar(`Đã thêm ${randomProduct.name} vào giỏ hàng`, 'success');
      
      setTimeout(simulateScan, 2000);
    }
  };

  useEffect(() => {
    if (isScanning) {
      simulateScan();
    }
  }, [isScanning]);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      showSnackbar('Giỏ hàng trống', 'warning');
      return;
    }

    const token = localStorage.getItem('token');
    try {
      const orderData = {
        cart: cart.map(item => ({
          _id: item._id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          ...(item.isWeighted && { weightGrams: item.weightGrams, weightKg: item.weightKg })
        })),
        totalAmount: totalAmount,
        paymentMethod: selectedPaymentMethod,
        status: 'paid',
        isGuest: !!currentUser?.isGuest,
        userId: currentUser?.isGuest ? null : currentUser?.id
      };

      const res = await axios.post(
        `${BACKEND_URL}/api/orders`,
        orderData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          }
        }
      );

      if (selectedPaymentMethod === 'CASH') {
        setPaymentData({
          orderId: res.data._id, // Store orderId for PDF download
          totalQuantity: cart.reduce((sum, item) => sum + item.quantity, 0),
          totalAmount: totalAmount,
          pointsEarned: res.data.pointsEarned
        });
        setOpenPaymentModal(true);
        showSnackbar('Thanh toán thành công', 'success'); 
        clearCart();
        setTimeout(() => {
          resetBarcodeState();
        }, 100);
      } else if (selectedPaymentMethod === 'MOMO') {
        const orderId = res.data._id;
        const paymentData = {
          orderId: orderId,
          orderInfo: 'Thanh toán đơn hàng',
          redirectUrl: `${MOMO_SERVER}/momo_return`,
          ipnUrl: `${MOMO_SERVER}/momo_ipn`,
          amount: totalAmount.toString(),
        };
        const paymentRes = await axios.post(`${MOMO_SERVER}/api/payment/payment`, paymentData, {
          headers: {
            Authorization: `Bearer ${token}`,
          }
        });
        if (paymentRes.data && paymentRes.data.data && paymentRes.data.data.payUrl) {
          window.location.href = paymentRes.data.data.payUrl;
        } else {
          throw new Error('Không tìm thấy payUrl trong phản hồi');
        }
      }
    } catch (err) {
      showSnackbar('Thanh toán thất bại', 'error');
      console.error('Checkout failed', err);
      if (err.response) {
        console.error('Backend error:', err.response.data);
      }
    }
  };

  const resetBarcodeState = () => {
    setLastRemoteBarcode(null);
    setBarcodeInput('');
    lastTsRef.current = null;
    setLastProcessedTs(null);
    isResetRef.current = true; // Đánh dấu đã reset
    console.log('Reset barcode state');
  };

  const handleDownloadInvoice = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Downloading invoice for orderId:', paymentData.orderId);
      console.log('Using token:', token);
      const response = await axios.get(
        `${BACKEND_URL}/api/bill/${paymentData.orderId}/invoice`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob' // Đảm bảo nhận blob
        }
      );
      console.log('Response data type:', typeof response.data); // Kiểm tra kiểu dữ liệu
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice_${paymentData.orderId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (error) {
      console.error('Không thể tải hóa đơn:', error);
      showSnackbar('Không thể tải hóa đơn', 'error');
    }
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const pointsEarned = Math.floor(totalAmount / 10000);

  const toggleChat = () => {
      setChatOpen(!chatOpen);
    };
  
    // --- non-stream helper (kept for fallback) ---
    const sendChatToModel = async (payload) => {
      try {
        const res = await axios.post(`${FLASK_API}/api/chat`, payload, { timeout: 60000 });
        return res.data;
      } catch (err) {
        console.error("sendChatToModel error:", err);
        throw err;
      }
    };
  
    // --- stream helper with Abort support ---
    // payload: model/prompt etc. onToken: (chunkText) onDone/onError
    const streamChatToModel = async (payload, onToken, onDone, onError, signal) => {
      try {
        const res = await fetch(`${FLASK_API}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal
        });
  
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Stream request failed: ${res.status} ${txt}`);
        }
  
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
  
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
  
          const parts = buffer.split('\n\n');
          buffer = parts.pop();
  
          for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed) continue;
  
            const lines = trimmed.split('\n');
            for (const line of lines) {
              if (line.startsWith('data:')) {
                const payloadText = line.slice(5).trim();
                try {
                  const parsed = JSON.parse(payloadText);
                  if (parsed && parsed.text) {
                    onToken(parsed.text);
                  } else if (parsed && parsed.response) {
                    // app.py uses key 'response' in example
                    onToken(parsed.response);
                  } else if (parsed && parsed.error) {
                    if (onError) onError(new Error(parsed.error));
                  }
                } catch (e) {
                  onToken(payloadText);
                }
              }
            }
          }
        }
  
        if (buffer.trim()) {
          const lines = buffer.split('\n');
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const payloadText = line.slice(5).trim();
              try {
                const parsed = JSON.parse(payloadText);
                if (parsed && parsed.text) onToken(parsed.text);
                else if (parsed && parsed.response) onToken(parsed.response);
              } catch (e) {
                onToken(payloadText);
              }
            }
          }
        }
  
        if (onDone) onDone();
      } catch (err) {
        // Abort is expected on user stop
        if (err.name === 'AbortError') {
          if (onError) onError(new Error('User stopped generation'));
          return;
        }
        console.error("streamChatToModel error:", err);
        if (onError) onError(err);
        else throw err;
      }
    };
  
    // handle send message (streaming)
    const handleSendMessage = () => {
      if (!newMessage.trim()) return;
  
      const messageText = newMessage.trim();
  
      const userMessage = {
        id: Date.now(),
        text: messageText,
        isBot: false,
        timestamp: new Date()
      };
  
      setChatMessages(prev => [...prev, userMessage]);
      setNewMessage('');
  
      const botId = Date.now() + 1;
      const botMessage = { id: botId, text: '', isBot: true, timestamp: new Date() };
      setChatMessages(prev => [...prev, botMessage]);
  
      const payload = {
        model: "gemma3:1b",
        prompt: messageText,
        stream: true
      };
  
      // begin streaming
      setIsChatStreaming(true);
      chatAbortRef.current = new AbortController();
      const signal = chatAbortRef.current.signal;
  
      streamChatToModel(
        payload,
        (chunkText) => {
          setChatMessages(prev => prev.map(m => m.id === botId ? { ...m, text: (m.text || '') + chunkText } : m));
        },
        () => {
          setChatMessages(prev => prev.map(m => m.id === botId ? { ...m, timestamp: new Date() } : m));
          setIsChatStreaming(false);
          chatAbortRef.current = null;
        },
        (err) => {
          setChatMessages(prev => [...prev, { id: Date.now()+2, text: `Lỗi từ model: ${err.message || err}`, isBot: true, timestamp: new Date() }]);
          setIsChatStreaming(false);
          chatAbortRef.current = null;
        },
        signal
      );
    };
  
    const stopChatStream = () => {
      if (chatAbortRef.current) {
        try { chatAbortRef.current.abort(); } catch (e) { /* ignore */ }
        chatAbortRef.current = null;
      }
      setIsChatStreaming(false);
    };
  
    const clearChatHistory = () => {
      setChatMessages([
        {
          id: 1,
          text: "Xin chào! Tôi là BIBI trợ lý ảo của siêu thị.",
          isBot: true,
          timestamp: new Date()
        }
      ]);
      setChatMenuAnchor(null);
      showSnackbar('Đã xóa lịch sử chat', 'success');
    };
  
    const handleChatMenuOpen = (event) => {
      setChatMenuAnchor(event.currentTarget);
    };
  
    const handleChatMenuClose = () => {
      setChatMenuAnchor(null);
    };

  return (
    <Container className="shopping-container" maxWidth="lg" sx={{ 
      py: scaled(0.5),
      px: scaled(0.5),
      height: '87vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Grid container spacing={scaled(0.5)} justifyContent="center" sx={{ 
        flex: 1,
        flexDirection: { xs: 'column', lg: 'row' },
        alignItems: 'stretch',
        overflow: 'hidden',
        mt: 0
      }}>
        <Grid xs={12} lg={6} justifyContent="center" sx={{  // Sửa ustifyContent thành justifyContent, loại bỏ item
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '55%',
        }}>
          <Paper sx={{ 
            p: scaled(0.5),
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <Typography variant="h6" gutterBottom sx={{ 
              textAlign: 'center', 
              mb: scaled(0.5),
              fontWeight: 'bold',
              fontSize: `${fontSize.title}rem`
            }}>
              <ScannerIcon sx={{ verticalAlign: 'middle', mr: scaled(0.5), fontSize: `${scaled(1.2)}rem` }} />
              NHẬP SẢN PHẨM
            </Typography>
            
            <Box sx={{ 
              bgcolor: 'grey.50', 
              p: scaled(1.5), 
              height: '100%',
              borderRadius: scaled(1), 
              border: '1px dashed', 
              borderColor: 'primary.light', 
              }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: scaled(1.5) }}>
                <ButtonGroup variant="outlined" color="primary" size="small">
                  <Button 
                    onClick={() => setInputMode('barcode')}
                    variant={inputMode === 'barcode' ? 'contained' : 'outlined'}
                    sx={{ fontSize: `${fontSize.button}rem` }}
                  >
                    Barcode
                  </Button>
                  <Button 
                    onClick={() => setInputMode('plu')}
                    variant={inputMode === 'plu' ? 'contained' : 'outlined'}
                    sx={{ fontSize: `${fontSize.button}rem` }}
                  >
                    Mã PLU
                  </Button>
                </ButtonGroup>
              </Box>
              
              {inputMode === 'barcode' ? (
                <>
                  <Typography variant="h6" gutterBottom sx={{ 
                    textAlign: 'center', 
                    mb: scaled(1.5), 
                    fontSize: `${fontSize.title}rem` 
                    }}>
                    Mã vạch sản phẩm (tự động từ Pi)
                  </Typography>

                  <Grid container justifyContent="center" alignItems="center" spacing={scaled(1)}>
                    <Grid xs={12}>
                      <TextField
                        fullWidth
                        label="Mã vạch sản phẩm"
                        value={lastRemoteBarcode || ''} 
                        variant="outlined"
                        size="small"
                        InputProps={{
                          readOnly: true, // chỉ hiển thị barcode từ Pi
                          }}
                        sx={{ 
                          '& .MuiOutlinedInput-root': { 
                            borderRadius: scaled(1), 
                            height: `${sizes.inputHeight}px`, 
                            fontSize: `${fontSize.input}rem` 
                          } 
                        }}
                      />
                    </Grid>
                  {/* Không cần nút thêm sản phẩm nữa, vì polling sẽ tự addToCart khi có barcode */}
                  </Grid>
              </>
              ) : (
                <>
                  <Typography variant="h6" gutterBottom sx={{ 
                    textAlign: 'center', 
                    mb: scaled(1), 
                    fontSize: `${fontSize.title}rem` 
                    }}>
                    Nhập mã PLU sản phẩm
                  </Typography>

                  <Grid container justifyContent="center" alignItems="center" spacing={scaled(1)}>
                    <Grid xs={6}>  {/* Loại bỏ item */}
                      <TextField
                        fullWidth
                        label="Mã PLU"
                        value={pluInput}
                        onChange={(e) => setPluInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            getWeightFromPi();
                          }
                        }}
                        variant="outlined"  
                        size="small"
                        sx={{ 
                          '& .MuiOutlinedInput-root': { 
                            borderRadius: scaled(1), 
                            height: `${sizes.inputHeight}px`, 
                            fontSize: `${fontSize.input}rem` 
                          } 
                        }}
                        />
                    </Grid>
                    <Grid xs={6}>  {/* Loại bỏ item */}
                      <TextField
                        fullWidth
                        label="Cân nặng (kg)"
                        value={weightInput}
                        variant="outlined"
                        size="small"
                        type="number"
                        InputProps={{
                          readOnly: true,
                          endAdornment: <InputAdornment position="end">kg</InputAdornment>,
                          startAdornment: <InputAdornment position="start">
                          <ScaleIcon sx={{ fontSize: `${scaled(1)}rem` }} color={weightInput ? "success" : "disabled"} />
                          </InputAdornment>
                        }}
                        sx={{ 
                          '& .MuiOutlinedInput-root': { 
                            borderRadius: scaled(0.25), 
                            height: `${sizes.inputHeight}px`, 
                            fontSize: `${fontSize.input}rem`, 
                            width: '100%',
                            bgcolor: weightInput ? 'success.light' : 'background.paper'
                          } 
                        }}
                      />  
                    </Grid>
                    <Grid xs={6}>  {/* Loại bỏ item */}
                        <Button
                          fullWidth
                          variant="contained"
                          color="primary"
                          onClick={getWeightFromPi}
                          disabled={isGettingWeight}
                          size="small"
                          startIcon={isGettingWeight ? <CircularProgress size={20} color="inherit" /> : <ScaleIcon />}
                          sx={{ 
                            justifyContent: 'center',
                            mt: scaled(0.5),
                            py: scaled(0.5),
                            height: `${sizes.inputHeight}px`, 
                            fontSize: `${fontSize.button}rem`, 
                            fontWeight: 'bold',
                            borderRadius: scaled(1)
                          }}
                        >
                        {isGettingWeight ? 'ĐANG LẤY DỮ LIỆU...' : 'LẤY CÂN NẶNG TỰ ĐỘNG'}
                      </Button>
                    </Grid>
                    <Grid xs={12} sx={{justifyContent: 'center'}}>  {/* Loại bỏ item */}
                      <Button
                        fullWidth
                        variant="contained"
                        color="secondary"
                        onClick={handlePluAdd}
                        size="small"
                        sx={{ 
                          justifyContent: 'center',
                          mt: scaled(0.5),
                          py: scaled(0.5),
                          height: `${sizes.inputHeight}px`, 
                          fontSize: `${fontSize.button}rem`, 
                          fontWeight: 'bold',
                          borderRadius: scaled(1)
                        }}
                      >
                      THÊM SẢN PHẨM
                      </Button>
                    </Grid>
                    {!weightInput && (
                      <Grid xs={12}>  {/* Loại bỏ item */}
                        <Typography variant="caption" color="error" sx={{ mt: scaled(0.5), display: 'block', fontSize: `${fontSize.caption}rem`, textAlign: 'center' }}>
                          ※ Vui lòng đặt sản phẩm lên cân sau khi nhập mã PLU
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </>
              )}
            </Box>
          </Paper>
        </Grid>

        <Grid xs={12} lg={6} sx={{  // Loại bỏ item
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '43%',
        }}>
          <Paper sx={{ 
            p: scaled(0.5),
            flex: 1,
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden',
          }}>
            <Typography variant="h6" gutterBottom sx={{ 
              fontWeight: 'bold', 
              color: 'primary.main', 
              textAlign: 'center', 
              mb: scaled(0.25),
              fontSize: `${fontSize.title}rem`
            }}>
              <CartIcon sx={{ verticalAlign: 'middle', mr: scaled(0.5), fontSize: `${fontSize.title}rem` }} />
              HÓA ĐƠN 
            </Typography>

            {cart.length === 0 ? (
              <Box sx={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                textAlign: 'center', 
                py: scaled(1)
              }}>
                <CartIcon sx={{ fontSize: scaled(40), color: 'action.disabled', mb: scaled(0.5) }} />
                <Typography variant="h6" sx={{ mb: scaled(0.25), fontSize: `${fontSize.subtitle}rem` }}>
                  Giỏ hàng trống
                </Typography>
                <Typography color="textSecondary" sx={{ fontSize: `${fontSize.caption}rem` }}>
                  Nhập mã vạch hoặc mã PLU để thêm sản phẩm
                </Typography>
              </Box>
            ) : (
              <>
                <List sx={{ 
                  flex: 1, 
                  overflow: 'auto', 
                  mb: scaled(0.5),
                  maxHeight: 'calc(100%)',
                }}>
                  {cart.map((item) => (
                    <React.Fragment key={item._id}>
                      <ListItem sx={{ 
                        px: 0, 
                        py: scaled(0.25),
                        '&:hover': { bgcolor: 'grey.50' } 
                      }}>
                        <ListItemText
                          primary={
                            <Typography variant="body1" fontWeight="medium" sx={{ fontSize: `${fontSize.body}rem` }}>
                              {item.name}
                              {item.isWeighted && (
                                <Typography component="span" variant="body2" color="textSecondary" sx={{ ml: scaled(0.25), fontSize: `${fontSize.caption}rem` }}>
                                  ({item.weight} kg)
                                </Typography>
                              )}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="body2" color="textSecondary" sx={{ fontSize: `${fontSize.caption}rem` }}>
                              {item.price.toLocaleString()}₫
                              {item.isWeighted && ` với ${item.pricePerKg?.toLocaleString()}₫/kg`}
                            </Typography>
                          }
                          sx={{ my: 0 }}
                        />
                        <Box sx={{ display: 'flex', alignItems: 'center', mr: scaled(0.5) }}>
                          <IconButton 
                            size="small"
                            onClick={() => updateQuantity(item._id, -1)}
                            sx={{ bgcolor: 'grey.100', p: scaled(0.25) }}
                          >
                            <RemoveIcon sx={{ fontSize: `${fontSize.caption}rem` }} />
                          </IconButton>
                          <Typography sx={{ mx: scaled(0.5), minWidth: scaled(15), textAlign: 'center', fontSize: `${fontSize.body}rem` }}>
                            {item.quantity}
                          </Typography>
                          <IconButton 
                            size="small"
                            onClick={() => updateQuantity(item._id, 1)}
                            sx={{ bgcolor: 'grey.100', p: scaled(0.25) }}
                          >
                            <AddIcon sx={{ fontSize: `${fontSize.caption}rem` }} />
                          </IconButton>
                        </Box>
                        <IconButton 
                          edge="end" 
                          onClick={() => removeFromCart(item._id)}
                          color="error"
                          size="small"
                          sx={{ p: scaled(0.25) }}
                        >
                          <DeleteIcon sx={{ fontSize: `${fontSize.caption}rem` }} />
                        </IconButton>
                      </ListItem>
                      <Divider />
                    </React.Fragment>
                  ))}
                </List>

                <Box sx={{ 
                  bgcolor: 'primary.main', 
                  color: 'white', 
                  p: scaled(0.5),
                  borderRadius: scaled(0.3),
                  mb: scaled(0.5)
                }}>
                  <Grid container>
                    <Grid xs={6}>  {/* Loại bỏ item */}
                      <Typography variant="body6" sx={{ fontSize: `${fontSize.body}rem` }}>
                        Tổng số lượng:
                      </Typography>
                    </Grid>
                    <Grid xs={6} textAlign="right">  {/* Loại bỏ item */}
                      <Typography variant="body6" fontWeight="bold" sx={{ fontSize: `${fontSize.body}rem` }}>
                        {totalItems} sản phẩm
                      </Typography>
                    </Grid>
                  </Grid>
                  <Divider sx={{ bgcolor: 'rgba(255,255,255,0.3)', my: scaled(0.5) }} />
                  <Grid container sx={{ mb: scaled(0.5) }}>
                    <Grid xs={6}>  {/* Loại bỏ item */}
                      <Typography variant="body6" sx={{ fontSize: `${fontSize.body}rem` }}>
                        TỔNG TIỀN:
                      </Typography>
                    </Grid>
                    <Grid xs={6} textAlign="right">  {/* Loại bỏ item */}
                      <Typography variant="body6" fontWeight="bold" sx={{ fontSize: `${fontSize.subtitle}rem` }} >
                        {totalAmount.toLocaleString()}₫
                      </Typography>
                    </Grid>
                  </Grid>
                  {!currentUser?.isGuest && (
                    <Typography variant="body1" textAlign="center" sx={{ fontStyle: 'italic', fontSize: `${fontSize.caption}rem` }}>
                      Điểm tích lũy: <strong>{pointsEarned}</strong> điểm
                    </Typography>
                  )}
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'center', mb: scaled(1) }}>
                  <ButtonGroup variant="outlined" color="primary" size="small">
                    <Button
                      onClick={() => setSelectedPaymentMethod('CASH')}
                      variant={selectedPaymentMethod === 'CASH' ? 'contained' : 'outlined'}
                      sx={{ fontSize: `${fontSize.button}rem` }}
                    >
                      Tiền mặt
                    </Button>
                    <Button
                      onClick={() => setSelectedPaymentMethod('MOMO')}
                      variant={selectedPaymentMethod === 'MOMO' ? 'contained' : 'outlined'}
                      sx={{ fontSize: `${fontSize.button}rem` }}
                    >
                      MoMo
                    </Button>
                  </ButtonGroup>
                </Box>

                <Button
                  fullWidth
                  variant="contained"
                  color="success"
                  startIcon={<PrintIcon sx={{ fontSize: `${fontSize.body}rem` }} />}
                  onClick={handleCheckout}
                  size="small"
                  sx={{ 
                    fontWeight: 'bold', 
                    height: `${sizes.buttonHeight}px`, 
                    fontSize: `${fontSize.button}rem`, 
                    borderRadius: scaled(0.5)
                  }}
                >
                  THANH TOÁN
                </Button>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Snackbar
        open={openSnackbar}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%', fontSize: `${fontSize.body}rem` }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>

      <Modal
        open={openPaymentModal}
        onClose={() => setOpenPaymentModal(false)}
        closeAfterTransition
        BackdropComponent={Backdrop}
        BackdropProps={{
          timeout: 500,
        }}
      >
        <Fade in={openPaymentModal}>
          <Box sx={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)', 
            width: { xs: '90%', sm: scaled(400) },
            bgcolor: 'background.paper', 
            boxShadow: 24, 
            p: scaled(2), 
            borderRadius: scaled(2), 
            textAlign: 'center' 
          }}>
            <IconButton
              sx={{ position: 'absolute', top: scaled(8), right: scaled(8) }}
              onClick={() => setOpenPaymentModal(false)}
            >
              <CloseIcon sx={{ fontSize: `${scaled(1.2)}rem` }} />
            </IconButton>
            
            <Typography variant="h4" sx={{ mb: scaled(1.5), fontWeight: 'bold', color: 'success.main', fontSize: `${scaled(1.5)}rem` }}>
              <PrintIcon sx={{ verticalAlign: 'middle', mr: scaled(0.5), fontSize: `${scaled(1.5)}rem` }} />
              THANH TOÁN THÀNH CÔNG!
            </Typography>
            
            <Paper sx={{ p: scaled(1.5), mb: scaled(1.5), bgcolor: 'grey.50' }}>
              <Grid container spacing={scaled(1)}>
                <Grid xs={6}>  {/* Loại bỏ item */}
                  <Typography variant="h6" sx={{ fontSize: `${fontSize.body}rem` }}>
                    Số lượng sản phẩm:
                  </Typography>
                </Grid>
                <Grid xs={6} textAlign="right">  {/* Loại bỏ item */}
                  <Typography variant="h6" fontWeight="bold" sx={{ fontSize: `${fontSize.body}rem` }}>
                    {paymentData?.totalQuantity}
                  </Typography>
                </Grid>
                
                <Grid xs={6}>  {/* Loại bỏ item */}
                  <Typography variant="h6" sx={{ fontSize: `${fontSize.body}rem` }}>
                    Tổng tiền:
                  </Typography>
                </Grid>
                <Grid xs={6} textAlign="right">  {/* Loại bỏ item */}
                  <Typography variant="h5" fontWeight="bold" color="primary.main" sx={{ fontSize: `${fontSize.subtitle}rem` }}>
                    {paymentData?.totalAmount.toLocaleString()}₫
                  </Typography>
                </Grid>
                
                {!currentUser?.isGuest && (
                  <>
                    <Grid xs={6}>  {/* Loại bỏ item */}
                      <Typography variant="h6" sx={{ fontSize: `${fontSize.body}rem` }}>
                        Điểm tích lũy:
                      </Typography>
                    </Grid>
                    <Grid xs={6} textAlign="right">  {/* Loại bỏ item */}
                      <Typography variant="h6" fontWeight="bold" color="secondary.main" sx={{ fontSize: `${fontSize.body}rem` }}>
                        {paymentData?.pointsEarned} điểm
                      </Typography>
                    </Grid>
                  </>
                )}
              </Grid>
            </Paper>
            
            <Typography variant="body1" color="textSecondary" sx={{ mb: scaled(1.5), fontStyle: 'italic', fontSize: `${fontSize.caption}rem` }}>
              Hóa đơn đã được gửi đến máy in
            </Typography>
            
            <Button
              fullWidth
              variant="contained"
              color="primary"
              size="medium"
              onClick={handleDownloadInvoice}
              sx={{ 
                mt: scaled(1), 
                height: `${sizes.inputHeight}px`, 
                fontSize: `${fontSize.button}rem`, 
                fontWeight: 'bold', 
                borderRadius: scaled(1)
              }}
            >
              TẢI HÓA ĐƠN PDF
            </Button>
            
            <Button
              fullWidth
              variant="contained"
              color="primary"
              size="medium"
              onClick={() => {
                setOpenPaymentModal(false);
                clearCart();
                setTimeout(() => {
                  resetBarcodeState();
                }, 100);
              }}
              sx={{ 
                mt: scaled(1), 
                height: `${sizes.inputHeight}px`, 
                fontSize: `${fontSize.button}rem`, 
                fontWeight: 'bold', 
                borderRadius: scaled(1)
              }}
            >
              TIẾP TỤC MUA SẮM
            </Button>
          </Box>
        </Fade>
      </Modal>

      {/* Chat FAB and panel (only chatbot-related UI shown here to keep file concise) */}
      <Fab 
        color="primary"
        sx={{ 
          position: 'fixed', 
          bottom: scaled(16), 
          right: scaled(16), 
          width: scaled(48), 
          height: scaled(48), 
          zIndex: 1000 
        }}
        onClick={toggleChat}
      >
        {chatOpen ? <CloseIcon sx={{ fontSize: `${scaled(1.2)}rem` }} /> : <ChatIcon sx={{ fontSize: `${scaled(1.2)}rem` }} />}
      </Fab>

      <Collapse in={chatOpen}>
        <Paper sx={{ 
          position: 'fixed', 
          bottom: scaled(70), 
          right: scaled(16), 
          width: scaled(320), 
          height: scaled(380), 
          zIndex: 999, 
          display: 'flex', 
          flexDirection: 'column', 
          borderRadius: scaled(2), 
          boxShadow: 6, 
          overflow: 'hidden' 
        }}>
          <Box sx={{ 
            bgcolor: 'primary.main', 
            color: 'white', 
            p: scaled(1), 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between' 
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <BotIcon sx={{ mr: scaled(0.5), fontSize: `${scaled(1.2)}rem` }} />
              <Typography variant="h6" fontWeight="bold" sx={{ fontSize: `${fontSize.subtitle}rem` }}>
                BIBI CHATBOT
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mr: scaled(1) }}>
                <Box sx={{ width: scaled(6), height: scaled(6), borderRadius: '50%', bgcolor: 'success.main', mr: scaled(0.5) }} />
                <Typography variant="body2" sx={{ fontSize: `${fontSize.caption}rem` }}>Trực tuyến</Typography>
              </Box>
              <IconButton
                color="inherit"
                size="small"
                onClick={handleChatMenuOpen}
                sx={{ p: scaled(0.25) }}
              >
                <MoreVertIcon sx={{ fontSize: `${scaled(1.0)}rem` }} />
              </IconButton>
            </Box>
          </Box>

          <Box sx={{ 
            flex: 1, 
            overflow: 'auto', 
            p: scaled(1), 
            bgcolor: 'grey.50', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: scaled(1)
          }}>
            {chatMessages.map((message) => {
              const ts = message.timestamp ? new Date(message.timestamp) : new Date();
              return (
                <Box
                  key={message.id}
                  sx={{ display: 'flex', alignItems: 'flex-start', gap: scaled(0.5), flexDirection: message.isBot ? 'row' : 'row-reverse' }}
                >
                  <Box sx={{ 
                    width: scaled(24), 
                    height: scaled(24), 
                    borderRadius: '50%', 
                    bgcolor: message.isBot ? 'primary.main' : 'secondary.main', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: 'white', 
                    flexShrink: 0 
                  }}>
                    {message.isBot ? 
                      <BotIcon sx={{ fontSize: scaled(14) }} /> : 
                      <PersonIcon sx={{ fontSize: scaled(14) }} /> 
                    }
                  </Box>
                  <Box sx={{ 
                    maxWidth: '70%', 
                    bgcolor: message.isBot ? 'white' : 'primary.main', 
                    color: message.isBot ? 'text.primary' : 'white', 
                    p: scaled(1), 
                    borderRadius: scaled(1), 
                    boxShadow: 1 
                  }}>
                    <Typography variant="body2" sx={{ fontSize: `${fontSize.body}rem`, whiteSpace: 'pre-wrap' }}>
                      {message.text}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: scaled(0.5), opacity: 0.7, fontSize: `${fontSize.caption}rem` }}>
                      {ts.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>

          <Box sx={{ 
            p: scaled(1), 
            bgcolor: 'white', 
            borderTop: 1, 
            borderColor: 'divider',
            display: 'flex',
            gap: scaled(0.5)
          }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Nhập tin nhắn..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isChatStreaming) handleSendMessage();
                }
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => { if (isChatStreaming) stopChatStream(); else handleSendMessage(); }}
                      color={isChatStreaming ? 'error' : 'primary'}
                      disabled={!newMessage.trim() && !isChatStreaming}
                      size="small"
                    >
                      {isChatStreaming ? <CloseIcon sx={{ fontSize: `${scaled(1.0)}rem` }} /> : <SendIcon sx={{ fontSize: `${scaled(1.0)}rem` }} />}
                    </IconButton>
                  </InputAdornment>
                ),
                sx: { 
                  borderRadius: scaled(1),
                  fontSize: `${fontSize.body}rem`
                }
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: scaled(1) } }}
              size="small"
            />
          </Box>
        </Paper>
      </Collapse>

      <Menu
        anchorEl={chatMenuAnchor}
        open={Boolean(chatMenuAnchor)}
        onClose={handleChatMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={clearChatHistory} sx={{ fontSize: `${fontSize.body}rem` }}>
          <ClearHistoryIcon sx={{ mr: scaled(1), fontSize: `${scaled(1.0)}rem` }} />
          Xóa lịch sử chat
        </MenuItem>
      </Menu>

      <Snackbar
        open={openSnackbar}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%', fontSize: `${fontSize.body}rem` }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ShoppingPage;