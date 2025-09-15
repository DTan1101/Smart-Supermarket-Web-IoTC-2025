import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Box, Grid, Typography, Paper, Tabs, Tab, Button, TextField, Select, MenuItem, Table, TableHead, TableBody, TableRow, TableCell, IconButton, TableContainer, TablePagination, CircularProgress, Alert, Modal } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, BarChart as ChartIcon, Settings as SettingsIcon, People as PeopleIcon, ShoppingBag as OrderIcon, Inventory as ProductIcon, AccountCircle as AccountIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
import axios from 'axios';
import { useTheme, useMediaQuery } from '@mui/material';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';

const AdminPage = () => {
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const scaleFactor = isMobile ? 0.85 : isTablet ? 0.95 : 1;
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

  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [barcodeProducts, setBarcodeProducts] = useState([]);
  const [pluProducts, setPluProducts] = useState([]);
  const [productView, setProductView] = useState('barcode');
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showProductForm, setShowProductForm] = useState(false);
  const [productType, setProductType] = useState('barcode');
  const [productForm, setProductForm] = useState({
    _id: '',
    barcode: '',
    pluCode: '',
    name: '',
    price: '',
    pricePerKg: '',
    category: 'Thực phẩm'
  });
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState({
    _id: '',
    username: '',
    fullName: '',
    email: '',
    phone: '',
    points: 0,
    isAdmin: false
  });
  const [admins, setAdmins] = useState([]);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminForm, setAdminForm] = useState({
    _id: '',
    username: '',
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    bankName: '',
    bankAccount: '',
    bankHolder: '',
    momoPhone: '',
    momoHolder: ''
  });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [sortByBarcode, setSortByBarcode] = useState('name');
  const [sortOrderBarcode, setSortOrderBarcode] = useState('asc');
  const [selectedCategoryBarcode, setSelectedCategoryBarcode] = useState('all');
  const [sortByPLU, setSortByPLU] = useState('name');
  const [sortOrderPLU, setSortOrderPLU] = useState('asc');
  const [selectedCategoryPLU, setSelectedCategoryPLU] = useState('all');
  
  // State cho xem thông tin và xác nhận mật khẩu
  const [viewAdmin, setViewAdmin] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [sortByOrders, setSortByOrders] = useState('createdAt');
  const [sortOrderOrders, setSortOrderOrders] = useState('desc');

  // --- START: settings state & helpers ---
  const [settings, setSettings] = useState({
    storeName: 'Siêu Thị Mini',
    address: '123 Đường Nguyễn Huệ, Quận 1, TP.HCM',
    phone: '(028) 1234 5678',
    pointsRate: 10000,    // VNĐ / điểm
    pointValue: 1000,     // VNĐ cho 1 điểm
    invoiceTitle: 'Siêu Thị Mini - Hóa Đơn Mua Hàng',
    invoiceNote: 'Cảm ơn quý khách đã mua sắm tại siêu thị chúng tôi!'
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  // load settings từ server hoặc localStorage (khi chuyển sang tab Cài đặt)
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem('token');
        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        // Thử load từ backend trước (yêu cầu backend cung cấp endpoint /api/settings)
        const res = await axios.get(`${BACKEND_URL}/api/settings`, config).catch(() => null);
        if (res && res.data) {
          setSettings(prev => ({ ...prev, ...res.data }));
        } else {
          // fallback: thử localStorage
          const saved = localStorage.getItem('adminSettings');
          if (saved) setSettings(JSON.parse(saved));
        }
      } catch (err) {
        console.warn('Không lấy được settings từ server, dùng localStorage nếu có', err);
        const saved = localStorage.getItem('adminSettings');
        if (saved) setSettings(JSON.parse(saved));
      }
    };

    if (activeTab === 4) fetchSettings();
  }, [activeTab, BACKEND_URL]);

  const handleSettingsChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  // Lưu settings: cố gắng call backend, nếu fail -> lưu vào localStorage
  const saveSettings = async () => {
    try {
      setSettingsLoading(true);
      const token = localStorage.getItem('token');
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      // chuẩn hóa 2 field số
      const payload = {
        ...settings,
        pointsRate: Number(settings.pointsRate),
        pointValue: Number(settings.pointValue)
      };

      // Gọi endpoint chung /api/settings (backend cần support). Nếu muốn tách, đổi URL tương ứng.
      const res = await axios.post(`${BACKEND_URL}/api/settings`, payload, config).catch(err => {
        // nếu backend không tồn tại hoặc lỗi, trả về null -> fallback
        return null;
      });

      if (res && res.data) {
        // thành công từ server
        setSettings(prev => ({ ...prev, ...res.data }));
        localStorage.removeItem('adminSettings'); // dọn local nếu đã có trên server
        setError('');
        alert('Lưu cài đặt thành công (server).');
      } else {
        // fallback: lưu tạm vào localStorage
        localStorage.setItem('adminSettings', JSON.stringify(payload));
        setError('');
        alert('Không lưu được lên server. Đã lưu tạm vào trình duyệt (localStorage).');
      }
    } catch (err) {
      console.error('Lưu settings lỗi', err);
      // fallback local
      localStorage.setItem('adminSettings', JSON.stringify(settings));
      setError('Lưu thất bại, đã lưu tạm vào trình duyệt');
      alert('Lưu thất bại, đã lưu tạm vào trình duyệt.');
    } finally {
      setSettingsLoading(false);
    }
  };
  // --- END settings helpers ---

  useEffect(() => {
    if (!currentUser || !currentUser.isAdmin) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        if (activeTab === 0) {
          const [barcodeRes, pluRes] = await Promise.all([
            axios.get(`${BACKEND_URL}/api/products`, config),
            axios.get(`${BACKEND_URL}/api/products/plu`, config)
          ]);
          setBarcodeProducts(barcodeRes.data.map(p => ({ ...p, type: 'barcode' })));
          setPluProducts(pluRes.data.map(p => ({ ...p, type: 'plu' })));
        } else if (activeTab === 1) {
          const res = await axios.get(`${BACKEND_URL}/api/users`, config);
          setUsers(res.data);
        } else if (activeTab === 2) {
          const res = await axios.get(`${BACKEND_URL}/api/orders`, config);
          const processedOrders = res.data.map(orderData => ({
            ...orderData,
            products: orderData.items ? orderData.items.map(item => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              isWeighted: item.isWeighted || false,
              weightGrams: item.weightGrams || 0
            })) : [],
            status: orderData.status || 'pending'
          }));
          setOrders(processedOrders);
        } else if (activeTab === 5) {
          const res = await axios.get(`${BACKEND_URL}/api/admin`, config);
          setAdmins(res.data);
        }
        setError('');
      } catch (err) {
        console.error('Lỗi tải dữ liệu:', err);
        setError('Không thể tải dữ liệu');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeTab, BACKEND_URL]);

  useEffect(() => {
    setPage(0);
  }, [productView]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleProductFormChange = (e) => {
    setProductForm({ ...productForm, [e.target.name]: e.target.value });
  };

  const handleUserFormChange = (e) => {
    setUserForm({ ...userForm, [e.target.name]: e.target.value });
  };

  const handleAdminFormChange = (e) => {
    setAdminForm({ ...adminForm, [e.target.name]: e.target.value });
  };

  const handleProductTypeChange = (e) => {
    setProductType(e.target.value);
    setProductForm({
      _id: '',
      barcode: '',
      pluCode: '',
      name: '',
      price: '',
      pricePerKg: '',
      category: 'Thực phẩm'
    });
  };

  const handleSortBarcode = (field) => {
    if (sortByBarcode === field) {
      setSortOrderBarcode(sortOrderBarcode === 'asc' ? 'desc' : 'asc');
    } else {
      setSortByBarcode(field);
      setSortOrderBarcode('asc');
    }
  };

  const handleSortPLU = (field) => {
    if (sortByPLU === field) {
      setSortOrderPLU(sortOrderPLU === 'asc' ? 'desc' : 'asc');
    } else {
      setSortByPLU(field);
      setSortOrderPLU('asc');
    }
  };

  const handleSortOrders = (field) => {
    if (sortByOrders === field) {
      setSortOrderOrders(sortOrderOrders === 'asc' ? 'desc' : 'asc');
    } else {
      setSortByOrders(field);
      setSortOrderOrders('asc');
    }
  };

  const sortedBarcodeProducts = [...barcodeProducts].sort((a, b) => {
    if (sortByBarcode === 'name') {
      return sortOrderBarcode === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    } else if (sortByBarcode === 'price') {
      return sortOrderBarcode === 'asc' ? a.price - b.price : b.price - a.price;
    }
    return 0;
  });
  const filteredBarcodeProducts = selectedCategoryBarcode === 'all'
    ? sortedBarcodeProducts
    : sortedBarcodeProducts.filter(product => product.category === selectedCategoryBarcode);

  const sortedPLUProducts = [...pluProducts].sort((a, b) => {
    if (sortByPLU === 'name') {
      return sortOrderPLU === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    } else if (sortByPLU === 'pricePerKg') {
      return sortOrderPLU === 'asc' ? a.pricePerKg - b.pricePerKg : b.pricePerKg - a.pricePerKg;
    }
    return 0;
  });
  const filteredPLUProducts = selectedCategoryPLU === 'all'
    ? sortedPLUProducts
    : sortedPLUProducts.filter(product => product.category === selectedCategoryPLU);

    const handleAddOrUpdateProduct = async () => {
    if (productType === 'barcode') {
      if (!productForm.barcode || !productForm.name || !productForm.price) {
        setError('Vui lòng nhập đầy đủ thông tin cho sản phẩm barcode');
        return;
      }
    } else if (productType === 'plu') {
      if (!productForm.pluCode || !productForm.name || !productForm.pricePerKg) {
        setError('Vui lòng nhập đầy đủ thông tin cho sản phẩm PLU');
        return;
      }
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      let res;
      if (productType === 'barcode') {
        if (productForm._id) {
          res = await axios.put(`${BACKEND_URL}/api/products/${productForm._id}`, {
            barcode: productForm.barcode,
            name: productForm.name,
            price: productForm.price,
            category: productForm.category
          }, { headers: { Authorization: `Bearer ${token}` } });
        } else {
          res = await axios.post(`${BACKEND_URL}/api/products`, {
            barcode: productForm.barcode,
            name: productForm.name,
            price: productForm.price,
            category: productForm.category,
          }, { headers: { Authorization: `Bearer ${token}` } });
        }
        const newProduct = { ...res.data, type: 'barcode' };
        if (productForm._id) {
          setBarcodeProducts(barcodeProducts.map(p => p._id === newProduct._id ? newProduct : p));
        } else {
          setBarcodeProducts([...barcodeProducts, newProduct]);
        }
      } else if (productType === 'plu') {
        if (productForm._id) {
          res = await axios.put(`${BACKEND_URL}/api/products/plu/${productForm._id}`, {
            pluCode: productForm.pluCode,
            name: productForm.name,
            pricePerKg: productForm.pricePerKg,
            category: productForm.category,
          }, { headers: { Authorization: `Bearer ${token}` } });
        } else {
          res = await axios.post(`${BACKEND_URL}/api/products/plu`, {
            pluCode: productForm.pluCode,
            name: productForm.name,
            pricePerKg: productForm.pricePerKg,
            category: productForm.category,
          }, { headers: { Authorization: `Bearer ${token}` } });
        }
        const newProduct = { ...res.data, type: 'plu' };
        if (productForm._id) {
          setPluProducts(pluProducts.map(p => p._id === newProduct._id ? newProduct : p));
        } else {
          setPluProducts([...pluProducts, newProduct]);
        }
      }
      setShowProductForm(false);
      setProductForm({
        _id: '',
        barcode: '',
        pluCode: '',
        name: '',
        price: '',
        pricePerKg: '',
        category: 'Thực phẩm'
      });
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Thao tác thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleEditProduct = (product) => {
    setProductType(product.type === 'plu' ? 'plu' : 'barcode');
    setProductForm({
      _id: product._id,
      barcode: product.barcode || '',
      pluCode: product.pluCode || '',
      name: product.name,
      price: product.price || '',
      pricePerKg: product.pricePerKg || '',
      category: product.category
    });
    setShowProductForm(true);
  };

  const handleDeleteProduct = async (product) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa sản phẩm này?')) {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const url = product.type === 'barcode' ? `${BACKEND_URL}/api/products/${product._id}` : `${BACKEND_URL}/api/products/plu/${product._id}`;
        await axios.delete(url, { headers: { Authorization: `Bearer ${token}` } });
        if (product.type === 'barcode') {
          setBarcodeProducts(barcodeProducts.filter(p => p._id !== product._id));
        } else {
          setPluProducts(pluProducts.filter(p => p._id !== product._id));
        }
        setError('');
      } catch (err) {
        setError('Xóa sản phẩm thất bại');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAddOrUpdateUser = async () => {
    if (!userForm.username || !userForm.fullName || !userForm.email) {
      setError('Vui lòng nhập đầy đủ thông tin người dùng');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      let res;
      if (userForm._id) {
        res = await axios.put(`${BACKEND_URL}/api/users/${userForm._id}`, {
          username: userForm.username,
          fullName: userForm.fullName,
          email: userForm.email,
          phone: userForm.phone,
          points: userForm.points,
          isAdmin: userForm.isAdmin
        }, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        res = await axios.post(`${BACKEND_URL}/api/users`, {
          username: userForm.username,
          fullName: userForm.fullName,
          email: userForm.email,
          phone: userForm.phone,
          points: userForm.points,
          isAdmin: userForm.isAdmin
        }, { headers: { Authorization: `Bearer ${token}` } });
      }
      setUsers(users.map(u => u._id === res.data._id ? res.data : u));
      setShowUserForm(false);
      setUserForm({
        _id: '',
        username: '',
        fullName: '',
        email: '',
        phone: '',
        points: 0,
        isAdmin: false
      });
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Thao tác thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user) => {
    setUserForm({
      _id: user._id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || '',
      points: user.points,
      isAdmin: user.isAdmin
    });
    setShowUserForm(true);
  };

  const handleDeleteUser = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa người dùng này?')) {
      try {
        setLoading(true);
        await axios.delete(`${BACKEND_URL}/api/users/${id}`);
        setUsers(users.filter(u => u._id !== id));
        setError('');
      } catch (err) {
        setError('Xóa người dùng thất bại');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAddOrUpdateAdmin = async () => {
    if (adminForm.password && adminForm.password !== adminForm.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      let res;
      if (adminForm._id) {
        res = await axios.put(`${BACKEND_URL}/api/admin/${adminForm._id}`, {
          username: adminForm.username,
          fullName: adminForm.fullName,
          email: adminForm.email,
          phone: adminForm.phone,
          password: adminForm.password || undefined,
          bankName: adminForm.bankName,
          bankAccount: adminForm.bankAccount,
          bankHolder: adminForm.bankHolder,
          momoPhone: adminForm.momoPhone,
          momoHolder: adminForm.momoHolder
        }, config);
      } else {
        res = await axios.post(`${BACKEND_URL}/api/admin/register`, {
          username: adminForm.username,
          fullName: adminForm.fullName,
          email: adminForm.email,
          phone: adminForm.phone,
          password: adminForm.password,
          bankName: adminForm.bankName,
          bankAccount: adminForm.bankAccount,
          bankHolder: adminForm.bankHolder,
          momoPhone: adminForm.momoPhone,
          momoHolder: adminForm.momoHolder
        }, config);
      }
      if (adminForm._id) {
        setAdmins(admins.map(a => a._id === res.data._id ? res.data : a));
      } else {
        setAdmins([...admins, res.data]);
      }
      setShowAdminForm(false);
      setAdminForm({
        _id: '',
        username: '',
        fullName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        bankName: '',
        bankAccount: '',
        bankHolder: '',
        momoPhone: '',
        momoHolder: ''
      });
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Thao tác thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleViewAdmin = (admin) => {
    setViewAdmin(admin);
    setShowViewModal(true);
  };

  const handleEditAdmin = (admin) => {
    setSelectedAdmin(admin);
    setShowPasswordConfirm(true);
  };

  const handleConfirmPassword = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.post(`${BACKEND_URL}/api/admin/verify-password`, { password: passwordInput }, config);
      if (res.data.success) {
        setShowPasswordConfirm(false);
        setAdminForm({
          _id: selectedAdmin._id,
          username: selectedAdmin.username,
          fullName: selectedAdmin.fullName,
          email: selectedAdmin.email,
          phone: selectedAdmin.phone || '',
          password: '',
          confirmPassword: '',
          bankName: selectedAdmin.bankName || '',
          bankAccount: selectedAdmin.bankAccount || '',
          bankHolder: selectedAdmin.bankHolder || '',
          momoPhone: selectedAdmin.momoPhone || '',
          momoHolder: selectedAdmin.momoHolder || ''
        });
        setShowAdminForm(true);
        setPasswordInput('');
      } else {
        setError('Mật khẩu không đúng');
      }
    } catch (err) {
      setError('Xác nhận mật khẩu thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdmin = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa admin này?')) {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        await axios.delete(`${BACKEND_URL}/api/admin/${id}`, config);
        setAdmins(admins.filter(a => a._id !== id));
        setError('');
      } catch (err) {
        setError('Xóa admin thất bại');
      } finally {
        setLoading(false);
      }
    }
  };

  // Lọc đơn đã thanh toán / hoàn tất
  const paidOrders = orders.filter(o => o.status === "paid" || o.status === "completed");

  // Gom sản phẩm theo tên
  const productStats = {};
  paidOrders.forEach(order => {
    order.products.forEach(item => {
      if (!productStats[item.name]) {
        productStats[item.name] = { quantity: 0, revenue: 0 };
      }
      productStats[item.name].quantity += item.quantity;
      productStats[item.name].revenue += item.price * item.quantity;
    });
  });

  // Lấy top 5 sản phẩm
  const topProducts = Object.entries(productStats)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // --- START: Thêm/Thay thế phần xử lý doanh thu (giờ / ngày / tháng) ---
  /* Gom doanh thu theo tháng (YYYY-MM) */ 
  const revenueByMonth = {};
  paidOrders.forEach(order => {
    const date = new Date(order.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!revenueByMonth[monthKey]) revenueByMonth[monthKey] = 0;

    const orderRevenue = order.products.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
    revenueByMonth[monthKey] += orderRevenue;
  });
  const monthlyRevenueData = Object.entries(revenueByMonth)
    .map(([month, revenue]) => ({ month, revenue }))
    .sort((a, b) => new Date(a.month) - new Date(b.month));

  /* Gom doanh thu theo ngày (YYYY-MM-DD) */
  const revenueByDayMap = {};
  paidOrders.forEach(order => {
    const date = new Date(order.createdAt);
    const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    if (!revenueByDayMap[dayKey]) revenueByDayMap[dayKey] = 0;

    const orderRevenue = order.products.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
    revenueByDayMap[dayKey] += orderRevenue;
  });
  const dailyRevenueData = Object.entries(revenueByDayMap)
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  /* Gom doanh thu theo giờ (0-23) - dùng order.products để consistent */
  const revenueByHour = Array.from({ length: 24 }, (_, i) => ({ hour: i, revenue: 0 }));
  paidOrders.forEach(order => {
    const date = new Date(order.createdAt);
    const hour = date.getHours();
    const orderRevenue = order.products.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
    revenueByHour[hour].revenue += orderRevenue;
  });
  // --- END xử lý dữ liệu ---
  // định dạng số theo locale Việt Nam, tối đa 2 chữ số thập phân, không bắt buộc 0 thập phân
  const nfMillion = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

  const tabLabels = [
    { label: 'Sản Phẩm', icon: <ProductIcon sx={{ fontSize: `${sizes.icon}px` }} /> },
    { label: 'Người Dùng', icon: <PeopleIcon sx={{ fontSize: `${sizes.icon}px` }} /> },
    { label: 'Đơn Hàng', icon: <OrderIcon sx={{ fontSize: `${sizes.icon}px` }} /> },
    { label: 'Báo Cáo', icon: <ChartIcon sx={{ fontSize: `${sizes.icon}px` }} /> },
    { label: 'Cài Đặt', icon: <SettingsIcon sx={{ fontSize: `${sizes.icon}px` }} /> },
    { label: 'Tài Khoản', icon: <AccountIcon sx={{ fontSize: `${sizes.icon}px` }} /> }
  ];

  return (
    <Box sx={{ p: spacing.medium }} className="admin-container">
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: `${fontSize.title}rem` }}>
        Trang Quản Trị
      </Typography>
      
      <Tabs className="admin-tabs"
        value={activeTab} 
        onChange={handleTabChange} 
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: spacing.large }}
      >
        {tabLabels.map((tab, index) => (
          <Tab key={index} label={tab.label} icon={tab.icon} iconPosition="start" />
        ))}
      </Tabs>
      
      {error && (
        <Alert severity="error" sx={{ mb: spacing.medium, fontSize: `${fontSize.body}rem` }}>
          {error}
        </Alert>
      )}
      
      {activeTab === 0 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: spacing.medium }}>
            <Typography variant="h5" sx={{ fontSize: `${fontSize.subtitle}rem` }}>DANH SÁCH SẢN PHẨM</Typography>
            <Box>
              <Button
                variant={productView === 'barcode' ? 'contained' : 'outlined'}
                onClick={() => setProductView('barcode')}
                sx={{ mr: 1, height: `${sizes.buttonHeight}px`, fontSize: `${fontSize.button}rem` }}
              >
                Barcode
              </Button>
              <Button
                variant={productView === 'plu' ? 'contained' : 'outlined'}
                onClick={() => setProductView('plu')}
                sx={{ mr: 1, height: `${sizes.buttonHeight}px`, fontSize: `${fontSize.button}rem` }}
              >
                PLU
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon sx={{ fontSize: `${sizes.icon}px` }} />}
                onClick={() => { setShowProductForm(true); setProductForm({ _id: '', barcode: '', pluCode: '', name: '', price: '', pricePerKg: '', category: 'Thực phẩm' }); }}
                sx={{ height: `${sizes.buttonHeight}px`, fontSize: `${fontSize.button}rem` }}
              >
                Thêm sản phẩm
              </Button>
            </Box>
          </Box>
          
          {showProductForm && (
            <Paper sx={{ p: spacing.medium, mb: spacing.large }}>
              <Typography variant="h6" gutterBottom sx={{ fontSize: `${fontSize.subtitle}rem` }}>Thêm/Sửa sản phẩm mới</Typography>
              <Grid container spacing={spacing.medium}>
                <Grid item xs={12}>
                  <Select
                    fullWidth
                    value={productType}
                    onChange={handleProductTypeChange}
                    sx={{ height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` }}
                  >
                    <MenuItem value="barcode">Sản phẩm Barcode</MenuItem>
                    <MenuItem value="plu">Sản phẩm PLU</MenuItem>
                  </Select>
                </Grid>
                {productType === 'barcode' && (
                  <>
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        label="Mã vạch"
                        name="barcode"
                        value={productForm.barcode}
                        onChange={handleProductFormChange}
                        sx={{ '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="Tên sản phẩm"
                        name="name"
                        value={productForm.name}
                        onChange={handleProductFormChange}
                        sx={{ '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        label="Giá (VNĐ)"
                        name="price"
                        type="number"
                        value={productForm.price}
                        onChange={handleProductFormChange}
                        sx={{ '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
                      />
                    </Grid>
                  </>
                )}
                {productType === 'plu' && (
                  <>
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        label="Mã PLU"
                        name="pluCode"
                        value={productForm.pluCode}
                        onChange={handleProductFormChange}
                        sx={{ '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="Tên sản phẩm"
                        name="name"
                        value={productForm.name}
                        onChange={handleProductFormChange}
                        sx={{ '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        label="Giá (VNĐ/kg)"
                        name="pricePerKg"
                        type="number"
                        value={productForm.pricePerKg}
                        onChange={handleProductFormChange}
                        sx={{ '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
                      />
                    </Grid>
                  </>
                )}
                <Grid item xs={12} md={3}>
                  <Select
                    fullWidth
                    name="category"
                    value={productForm.category}
                    onChange={handleProductFormChange}
                    sx={{ height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` }}
                  >
                    <MenuItem value="Thực phẩm">Thực phẩm</MenuItem>
                    <MenuItem value="Đồ uống">Đồ uống</MenuItem>
                    <MenuItem value="Đồ gia dụng">Đồ gia dụng</MenuItem>
                    <MenuItem value="Đồ điện tử">Đồ điện tử</MenuItem>
                    <MenuItem value="Chăm sóc cá nhân">Chăm sóc cá nhân</MenuItem>
                    <MenuItem value="Rau củ">Rau củ</MenuItem>
                    <MenuItem value="Trái cây">Trái cây</MenuItem>
                    <MenuItem value="Khác">Khác</MenuItem>
                  </Select>
                </Grid>
              </Grid>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: spacing.medium, gap: spacing.small }}>
                <Button variant="outlined" onClick={() => setShowProductForm(false)} sx={{ height: `${sizes.buttonHeight}px`, fontSize: `${fontSize.button}rem` }}>
                  Hủy
                </Button>
                <Button variant="contained" color="primary" onClick={handleAddOrUpdateProduct} disabled={loading} sx={{ height: `${sizes.buttonHeight}px`, fontSize: `${fontSize.button}rem` }}>
                  {loading ? <CircularProgress size={sizes.icon} /> : productForm._id ? 'Cập nhật' : 'Lưu'}
                </Button>
              </Box>
            </Paper>
          )}
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: spacing.large }}>
              <CircularProgress size={sizes.icon} />
            </Box>
          ) : productView === 'barcode' ? (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: spacing.medium }}>
                <Typography variant="h6" sx={{ fontSize: `${fontSize.subtitle}rem` }}>Danh sách sản phẩm Barcode</Typography>
                <Select
                  value={selectedCategoryBarcode}
                  onChange={(e) => setSelectedCategoryBarcode(e.target.value)}
                  sx={{ height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` }}
                >
                  <MenuItem value="all">Tất cả</MenuItem>
                  <MenuItem value="Thực phẩm">Thực phẩm</MenuItem>
                  <MenuItem value="Đồ uống">Đồ uống</MenuItem>
                  <MenuItem value="Đồ gia dụng">Đồ gia dụng</MenuItem>
                  <MenuItem value="Đồ điện tử">Đồ điện tử</MenuItem>
                  <MenuItem value="Chăm sóc cá nhân">Chăm sóc cá nhân</MenuItem>
                  <MenuItem value="Rau củ">Rau củ</MenuItem>
                  <MenuItem value="Trái cây">Trái cây</MenuItem>
                  <MenuItem value="Khác">Khác</MenuItem>
                </Select>
              </Box>
              <TableContainer component={Paper} sx={{ maxHeight: { xs: scaled(400), md: scaled(600) } }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ padding: { xs: `${spacing.small}rem ${spacing.small / 2}rem`, sm: `${spacing.medium}rem` }, fontSize: `${fontSize.body}rem` }}>Mã vạch</TableCell>
                      <TableCell onClick={() => handleSortBarcode('name')} sx={{ padding: { xs: `${spacing.small}rem ${spacing.small / 2}rem`, sm: `${spacing.medium}rem` }, fontSize: `${fontSize.body}rem`, cursor: 'pointer' }}>
                        Tên sản phẩm {sortByBarcode === 'name' && (sortOrderBarcode === 'asc' ? '↑' : '↓')}
                      </TableCell>
                      <TableCell onClick={() => handleSortBarcode('price')} sx={{ padding: { xs: `${spacing.small}rem ${spacing.small / 2}rem`, sm: `${spacing.medium}rem` }, fontSize: `${fontSize.body}rem`, cursor: 'pointer' }}>
                        Giá {sortByBarcode === 'price' && (sortOrderBarcode === 'asc' ? '↑' : '↓')}
                      </TableCell>
                      <TableCell sx={{ padding: { xs: `${spacing.small}rem ${spacing.small / 2}rem`, sm: `${spacing.medium}rem` }, fontSize: `${fontSize.body}rem` }}>Danh mục</TableCell>
                      <TableCell sx={{ padding: { xs: `${spacing.small}rem ${spacing.small / 2}rem`, sm: `${spacing.medium}rem` }, fontSize: `${fontSize.body}rem` }} align="right">Thao tác</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredBarcodeProducts
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((product) => (
                        <TableRow key={product._id}>
                          <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>{product.barcode}</TableCell>
                          <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>{product.name}</TableCell>
                          <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>{product.price.toLocaleString()}</TableCell>
                          <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>{product.category}</TableCell>
                          <TableCell align="right">
                            <IconButton color="primary" onClick={() => handleEditProduct(product)} sx={{ p: spacing.small }}>
                              <EditIcon sx={{ fontSize: `${sizes.icon}px` }} />
                            </IconButton>
                            <IconButton color="error" onClick={() => handleDeleteProduct(product)} sx={{ p: spacing.small }}>
                              <DeleteIcon sx={{ fontSize: `${sizes.icon}px` }} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25]}
                  component="div"
                  count={filteredBarcodeProducts.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  sx={{ '& .MuiTablePagination-selectLabel': { fontSize: `${fontSize.caption}rem` }, '& .MuiTablePagination-displayedRows': { fontSize: `${fontSize.caption}rem` } }}
                />
              </TableContainer>
            </>
          ) : (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: spacing.medium }}>
                <Typography variant="h6" sx={{ fontSize: `${fontSize.subtitle}rem` }}>Danh sách sản phẩm PLU</Typography>
                <Select
                  value={selectedCategoryPLU}
                  onChange={(e) => setSelectedCategoryPLU(e.target.value)}
                  sx={{ height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` }}
                >
                  <MenuItem value="all">Tất cả</MenuItem>
                  <MenuItem value="Thực phẩm">Thực phẩm</MenuItem>
                  <MenuItem value="Đồ uống">Đồ uống</MenuItem>
                  <MenuItem value="Đồ gia dụng">Đồ gia dụng</MenuItem>
                  <MenuItem value="Đồ điện tử">Đồ điện tử</MenuItem>
                  <MenuItem value="Chăm sóc cá nhân">Chăm sóc cá nhân</MenuItem>
                  <MenuItem value="Rau củ">Rau củ</MenuItem>
                  <MenuItem value="Trái cây">Trái cây</MenuItem>
                  <MenuItem value="Khác">Khác</MenuItem>
                </Select>
              </Box>
              <TableContainer component={Paper} sx={{ maxHeight: { xs: scaled(400), md: scaled(600) } }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ padding: { xs: `${spacing.small}rem ${spacing.small / 2}rem`, sm: `${spacing.medium}rem` }, fontSize: `${fontSize.body}rem` }}>Mã PLU</TableCell>
                      <TableCell onClick={() => handleSortPLU('name')} sx={{ padding: { xs: `${spacing.small}rem ${spacing.small / 2}rem`, sm: `${spacing.medium}rem` }, fontSize: `${fontSize.body}rem`, cursor: 'pointer' }}>
                        Tên sản phẩm {sortByPLU === 'name' && (sortOrderPLU === 'asc' ? '↑' : '↓')}
                      </TableCell>
                      <TableCell onClick={() => handleSortPLU('pricePerKg')} sx={{ padding: { xs: `${spacing.small}rem ${spacing.small / 2}rem`, sm: `${spacing.medium}rem` }, fontSize: `${fontSize.body}rem`, cursor: 'pointer' }}>
                        Giá (VNĐ/kg) {sortByPLU === 'pricePerKg' && (sortOrderPLU === 'asc' ? '↑' : '↓')}
                      </TableCell>
                      <TableCell sx={{ padding: { xs: `${spacing.small}rem ${spacing.small / 2}rem`, sm: `${spacing.medium}rem` }, fontSize: `${fontSize.body}rem` }}>Danh mục</TableCell>
                      <TableCell sx={{ padding: { xs: `${spacing.small}rem ${spacing.small / 2}rem`, sm: `${spacing.medium}rem` }, fontSize: `${fontSize.body}rem` }} align="right">Thao tác</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredPLUProducts
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((product) => (
                        <TableRow key={product._id}>
                          <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>{product.pluCode}</TableCell>
                          <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>{product.name}</TableCell>
                          <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>{product.pricePerKg.toLocaleString()}/kg</TableCell>
                          <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>{product.category}</TableCell>
                          <TableCell align="right">
                            <IconButton color="primary" onClick={() => handleEditProduct(product)} sx={{ p: spacing.small }}>
                              <EditIcon sx={{ fontSize: `${sizes.icon}px` }} />
                            </IconButton>
                            <IconButton color="error" onClick={() => handleDeleteProduct(product)} sx={{ p: spacing.small }}>
                              <DeleteIcon sx={{ fontSize: `${sizes.icon}px` }} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25]}
                  component="div"
                  count={filteredPLUProducts.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  sx={{ '& .MuiTablePagination-selectLabel': { fontSize: `${fontSize.caption}rem` }, '& .MuiTablePagination-displayedRows': { fontSize: `${fontSize.caption}rem` } }}
                />
              </TableContainer>
            </>
          )}
        </Box>
      )}
      
      {activeTab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: spacing.medium }}>
            <Typography variant="h6" sx={{ fontSize: `${fontSize.subtitle}rem` }}>Danh sách người dùng</Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon sx={{ fontSize: `${sizes.icon}px` }} />}
              onClick={() => { setShowUserForm(true); setUserForm({ _id: '', username: '', fullName: '', email: '', phone: '', points: 0, isAdmin: false }); }}
              sx={{ height: `${sizes.buttonHeight}px`, fontSize: `${fontSize.button}rem` }}
            >
              Thêm người dùng
            </Button>
          </Box>
          
          {showUserForm && (
            <Paper sx={{ p: spacing.medium, mb: spacing.large }}>
              <Typography variant="h6" gutterBottom sx={{ fontSize: `${fontSize.subtitle}rem` }}>Thêm/Sửa người dùng</Typography>
              <Grid container spacing={spacing.medium}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Tên đăng nhập"
                    name="username"
                    value={userForm.username}
                    onChange={handleUserFormChange}
                    sx={{ '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Họ tên"
                    name="fullName"
                    value={userForm.fullName}
                    onChange={handleUserFormChange}
                    sx={{ '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Email"
                    name="email"
                    value={userForm.email}
                    onChange={handleUserFormChange}
                    sx={{ '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Số điện thoại"
                    name="phone"
                    value={userForm.phone}
                    onChange={handleUserFormChange}
                    sx={{ '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Điểm tích lũy"
                    name="points"
                    type="number"
                    value={userForm.points}
                    onChange={handleUserFormChange}
                    sx={{ '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Select
                    fullWidth
                    name="isAdmin"
                    value={userForm.isAdmin}
                    onChange={(e) => setUserForm({ ...userForm, isAdmin: e.target.value })}
                    sx={{ height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` }}
                  >
                    <MenuItem value={false}>Người dùng</MenuItem>
                    <MenuItem value={true}>Quản trị viên</MenuItem>
                  </Select>
                </Grid>
              </Grid>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: spacing.medium, gap: spacing.small }}>
                <Button variant="outlined" onClick={() => setShowUserForm(false)} sx={{ height: `${sizes.buttonHeight}px`, fontSize: `${fontSize.button}rem` }}>
                  Hủy
                </Button>
                <Button variant="contained" color="primary" onClick={handleAddOrUpdateUser} disabled={loading} sx={{ height: `${sizes.buttonHeight}px`, fontSize: `${fontSize.button}rem` }}>
                  {loading ? <CircularProgress size={sizes.icon} /> : userForm._id ? 'Cập nhật' : 'Lưu'}
                </Button>
              </Box>
            </Paper>
          )}
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: spacing.large }}>
              <CircularProgress size={sizes.icon} />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>ID</TableCell>
                    <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>Tên đăng nhập</TableCell>
                    <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>Họ tên</TableCell>
                    <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>Email</TableCell>
                    <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>Điểm tích lũy</TableCell>
                    <TableCell sx={{ fontSize: `${fontSize.body}rem` }} align="right">Thao tác</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((user) => (
                      <TableRow key={user._id}>
                        <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>{user._id.substring(0, 6)}</TableCell>
                        <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>{user.username}</TableCell>
                        <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>{user.fullName}</TableCell>
                        <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>{user.email}</TableCell>
                        <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>{user.points}</TableCell>
                        <TableCell align="right">
                          <IconButton color="primary" onClick={() => handleEditUser(user)} sx={{ p: spacing.small }}>
                            <EditIcon sx={{ fontSize: `${sizes.icon}px` }} />
                          </IconButton>
                          <IconButton color="error" onClick={() => handleDeleteUser(user._id)} sx={{ p: spacing.small }}>
                            <DeleteIcon sx={{ fontSize: `${sizes.icon}px` }} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              <TablePagination
                rowsPerPageOptions={[5, 10, 25]}
                component="div"
                count={users.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                sx={{ '& .MuiTablePagination-selectLabel': { fontSize: `${fontSize.caption}rem` }, '& .MuiTablePagination-displayedRows': { fontSize: `${fontSize.caption}rem` } }}
              />
            </TableContainer>
          )}
        </Box>
      )}
      
      {activeTab === 2 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: spacing.medium }}>
            <Typography variant="h6" sx={{ fontSize: `${fontSize.subtitle}rem` }}>Lịch sử đơn hàng</Typography>
            <Button 
              variant="outlined" 
              onClick={() => {
                // Refetch orders
                const fetchOrders = async () => {
                  try {
                    setLoading(true);
                    const token = localStorage.getItem('token');
                    const config = { headers: { Authorization: `Bearer ${token}` } };
                    const res = await axios.get(`${BACKEND_URL}/api/orders`, config);
                    
                    // Process orders to include status and properly format products
                    const processedOrders = res.data.map(orderData => ({
                      ...orderData,
                      products: orderData.items ? orderData.items.map(item => ({
                        name: item.name,
                        quantity: item.quantity,
                        price: item.price,
                        isWeighted: item.isWeighted || false,
                        weightGrams: item.weightGrams || 0
                      })) : [],
                      // Ensure status is properly handled with a default value
                      status: orderData.status || 'pending'
                    }));
                    setOrders(processedOrders);
                    setError('');
                  } catch (err) {
                    console.error('Lỗi tải dữ liệu đơn hàng:', err);
                    setError('Không thể tải dữ liệu đơn hàng');
                  } finally {
                    setLoading(false);
                  }
                };
                fetchOrders();
              }}
              sx={{ height: `${sizes.buttonHeight}px`, fontSize: `${fontSize.button}rem` }}
            >
              Làm mới
            </Button>
          </Box>
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: spacing.large }}>
              <CircularProgress size={sizes.icon} />
            </Box>
          ) : (
            (() => {
              const sortedOrders = [...orders].sort((a, b) => {
                let aValue, bValue;
                
                switch (sortByOrders) {
                  case 'customer':
                    aValue = a.user?.fullName || 'Khách';
                    bValue = b.user?.fullName || 'Khách';
                    break;
                  case 'products':
                    aValue = a.products?.map(p => p.name).join(', ') || '';
                    bValue = b.products?.map(p => p.name).join(', ') || '';
                    break;
                  case 'total':
                    aValue = a.total;
                    bValue = b.total;
                    break;
                  case 'date':
                  default:
                    aValue = new Date(a.createdAt);
                    bValue = new Date(b.createdAt);
                    break;
                }
                
                if (typeof aValue === 'string') {
                  return sortOrderOrders === 'asc' 
                    ? aValue.localeCompare(bValue) 
                    : bValue.localeCompare(aValue);
                } else {
                  return sortOrderOrders === 'asc' 
                    ? aValue - bValue 
                    : bValue - aValue;
                }
              });
              return (
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>Mã đơn hàng</TableCell>
                        <TableCell 
                          sx={{ fontSize: `${fontSize.body}rem`, cursor: 'pointer' }}
                          onClick={() => handleSortOrders('date')}
                        >
                          Ngày mua {sortByOrders === 'date' && (sortOrderOrders === 'asc' ? '↑' : '↓')}
                        </TableCell>
                        <TableCell 
                          sx={{ fontSize: `${fontSize.body}rem`, cursor: 'pointer' }}
                          onClick={() => handleSortOrders('customer')}
                        >
                          Khách hàng {sortByOrders === 'customer' && (sortOrderOrders === 'asc' ? '↑' : '↓')}
                        </TableCell>
                        <TableCell 
                          sx={{ fontSize: `${fontSize.body}rem`, cursor: 'pointer' }}
                          onClick={() => handleSortOrders('products')}
                        >
                          Sản phẩm đã mua {sortByOrders === 'products' && (sortOrderOrders === 'asc' ? '↑' : '↓')}
                        </TableCell>
                        <TableCell 
                          sx={{ fontSize: `${fontSize.body}rem`, cursor: 'pointer' }}
                          onClick={() => handleSortOrders('total')}
                        >
                          Tổng tiền {sortByOrders === 'total' && (sortOrderOrders === 'asc' ? '↑' : '↓')}
                        </TableCell>
                        <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>Điểm tích lũy</TableCell>
                        <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>Trạng thái</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortedOrders
                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map((order) => (
                          <TableRow key={order._id}>
                            <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>{order._id.substring(0, 8)}</TableCell>
                            <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>{order.user?.fullName || 'Khách'}</TableCell>
                            <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>
                              {order.products?.map(p => `${p.name} (x${p.quantity})`).join(', ') || 'N/A'}
                            </TableCell>
                            <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>{order.total.toLocaleString()}₫</TableCell>
                            <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>{order.pointsEarned}</TableCell>
                            <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>
                              <span style={{ 
                                color: order.status === 'paid' ? 'green' : 'orange',
                                fontWeight: 'bold'
                              }}>
                                {order.status === 'paid' ? 'Đã thanh toán' : 'Đang xử lý'}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                  <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={sortedOrders.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    sx={{ '& .MuiTablePagination-selectLabel': { fontSize: `${fontSize.caption}rem` }, '& .MuiTablePagination-displayedRows': { fontSize: `${fontSize.caption}rem` } }}
                  />
                </TableContainer>
              );
            })()
          )}
        </Box>
      )}

      {activeTab === 3 && (
        <Box sx={{ px: 2 }}>
          {/* Tiêu đề đặt trên cùng, full width */}
          <Typography variant="h6" sx={{ mb: spacing.medium, fontSize: `${fontSize.subtitle}rem` }}>
            Báo cáo doanh thu
          </Typography>

          {/* Container cho 3 chart - flex để chia đều không gian */}
          <Box
            sx={{
              display: 'flex',
              gap: 3,
              alignItems: 'stretch',
              flexDirection: { xs: 'column', md: 'row' }, // xs: dọc, md+: ngang
            }}
          >
            {/* Chart 1 - Hour */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Paper sx={{ p: spacing.medium, height: { xs: 420, md: '70vh' }, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" sx={{ mb: spacing.small, fontSize: `${fontSize.subtitle}rem` }}>
                  Doanh thu theo giờ
                </Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueByHour} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} />
                      <YAxis
                        tick={{ fontSize: 12, fill: '#011a04ff' }}
                        tickFormatter={(v) => `${nfMillion.format(v / 1_000_000)}`} 
                        // thêm label đơn vị dọc trục Y
                        label={{
                          value: 'Đơn vị: triệu đồng',
                          angle: -90,
                          position: 'insideLeft',
                          offset: 10,
                          style: { textAnchor: 'middle', fontSize: 12, fill: '#011a04ff' }
                        }}
                      />
                      <Tooltip
                        formatter={(value) => `${nfMillion.format(value / 1_000_000)} triệu đồng`}
                        wrapperStyle={{ fontSize: '12px' }}
                        contentStyle={{ fontSize: '12px' }}
                        labelStyle={{ fontSize: '11px' }}
                      />
                      <Line type="monotone" dataKey="revenue" stroke="#1f77b4" strokeWidth={3} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Box>

            {/* Chart 2 - Day */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Paper sx={{ p: spacing.medium, height: { xs: 420, md: '70vh' }, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" sx={{ mb: spacing.small, fontSize: `${fontSize.subtitle}rem` }}>
                  Doanh thu theo ngày
                </Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyRevenueData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" interval={Math.max(0, Math.floor(dailyRevenueData.length/10))} />
                      <YAxis
                        tick={{ fontSize: 12, fill: '#011a04ff' }}
                        tickFormatter={(v) => `${nfMillion.format(v / 1_000_000)}`} 
                        // thêm label đơn vị dọc trục Y
                        label={{
                          value: 'Đơn vị: triệu đồng',
                          angle: -90,
                          position: 'insideLeft',
                          offset: 10,
                          style: { textAnchor: 'middle', fontSize: 12, fill: '#011a04ff' }
                        }}
                      />
                      <Tooltip
                        formatter={(value) => `${nfMillion.format(value / 1_000_000)} triệu đồng`}
                        wrapperStyle={{ fontSize: '12px' }}
                        contentStyle={{ fontSize: '12px' }}
                        labelStyle={{ fontSize: '11px' }}
                      />
                      <Line type="monotone" dataKey="revenue" stroke="#ff7f0e" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Box>

            {/* Chart 3 - Month */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Paper sx={{ p: spacing.medium, height: { xs: 420, md: '70vh' }, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" color="textSecondary" sx={{ mb: spacing.small, fontSize: `${fontSize.subtitle}rem` }}>
                  Doanh thu theo tháng
                </Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyRevenueData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis
                        tick={{ fontSize: 12, fill: '#011a04ff' }}
                        tickFormatter={(v) => `${nfMillion.format(v / 1_000_000)}`} 
                        // thêm label đơn vị dọc trục Y
                        label={{
                          value: 'Đơn vị: triệu đồng',
                          angle: -90,
                          position: 'insideLeft',
                          offset: 10,
                          style: { textAnchor: 'middle', fontSize: 12, fill: '#011a04ff' }
                        }}
                      />
                      <Tooltip
                        formatter={(value) => `${nfMillion.format(value / 1_000_000)} triệu đồng`}
                        wrapperStyle={{ fontSize: '12px' }}
                        contentStyle={{ fontSize: '12px' }}
                        labelStyle={{ fontSize: '11px' }}
                      />
                      <Line type="monotone" dataKey="revenue" stroke="#2ca02c" strokeWidth={3} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Box>
          </Box>

          {/* Top sản phẩm (giữ nguyên layout bảng) */}
          <Box sx={{ mt: spacing.large }}>
            <Paper sx={{ p: spacing.medium }}>
              <Typography variant="h6" sx={{ mb: spacing.medium, fontSize: `${fontSize.subtitle}rem` }}>
                Top sản phẩm bán chạy
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>Sản phẩm</TableCell>
                    <TableCell align="right" sx={{ fontSize: `${fontSize.body}rem` }}>Số lượng đã bán</TableCell>
                    <TableCell align="right" sx={{ fontSize: `${fontSize.body}rem` }}>Doanh thu</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topProducts.length > 0 ? (
                    topProducts.map((prod, idx) => (
                      <TableRow key={idx}>
                        <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>{prod.name}</TableCell>
                        <TableCell align="right" sx={{ fontSize: `${fontSize.body}rem` }}>{prod.quantity}</TableCell>
                        <TableCell align="right" sx={{ fontSize: `${fontSize.body}rem` }}>{prod.revenue.toLocaleString()}₫</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} align="center">Chưa có dữ liệu</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          </Box>
        </Box>
      )}
      
{activeTab === 4 && (
  <Box>
    <Typography variant="h6" sx={{ mb: spacing.medium, fontSize: `${fontSize.subtitle}rem` }}>Cài đặt hệ thống</Typography>
    <Grid container spacing={spacing.large}>
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: spacing.medium }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontSize: `${fontSize.subtitle}rem` }}>Cài đặt siêu thị</Typography>

          <TextField
            fullWidth
            label="Tên siêu thị"
            name="storeName"
            value={settings.storeName}
            onChange={handleSettingsChange}
            sx={{ mb: spacing.medium, '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
          />

          <TextField
            fullWidth
            label="Địa chỉ"
            name="address"
            value={settings.address}
            onChange={handleSettingsChange}
            sx={{ mb: spacing.medium, '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
          />

          <TextField
            fullWidth
            label="Số điện thoại"
            name="phone"
            value={settings.phone}
            onChange={handleSettingsChange}
            sx={{ mb: spacing.medium, '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
          />

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: spacing.medium }}>
            <Button variant="outlined" onClick={() => {
              // reset về mặc định (hoặc reload từ localStorage/server)
              const saved = localStorage.getItem('adminSettings');
              if (saved) setSettings(JSON.parse(saved));
              else setSettings(prev => ({ ...prev })); // giữ nguyên
            }} sx={{ height: `${sizes.buttonHeight}px`, fontSize: `${fontSize.button}rem` }}>
              Hoàn tác
            </Button>

            <Button variant="contained" color="primary" onClick={saveSettings} disabled={settingsLoading} sx={{ height: `${sizes.buttonHeight}px`, fontSize: `${fontSize.button}rem` }}>
              {settingsLoading ? <CircularProgress size={sizes.icon} /> : 'Lưu thay đổi'}
            </Button>
          </Box>
        </Paper>
      </Grid>

      <Grid item xs={12} md={6}>
        <Paper sx={{ p: spacing.medium }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontSize: `${fontSize.subtitle}rem` }}>Tích điểm</Typography>

          <TextField
            fullWidth
            label="Tỷ lệ tích điểm (VNĐ/điểm)"
            name="pointsRate"
            type="number"
            value={settings.pointsRate}
            onChange={handleSettingsChange}
            sx={{ mb: spacing.medium, '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
            helperText="Số tiền cần chi tiêu để tích lũy 1 điểm"
          />

          <TextField
            fullWidth
            label="Giá trị điểm (VNĐ/điểm)"
            name="pointValue"
            type="number"
            value={settings.pointValue}
            onChange={handleSettingsChange}
            sx={{ mb: spacing.medium, '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
            helperText="Giá trị quy đổi 1 điểm thành tiền mặt"
          />

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button variant="contained" color="primary" onClick={saveSettings} disabled={settingsLoading} sx={{ height: `${sizes.buttonHeight}px`, fontSize: `${fontSize.button}rem` }}>
              {settingsLoading ? <CircularProgress size={sizes.icon} /> : 'Lưu thay đổi'}
            </Button>
          </Box>
        </Paper>
      </Grid>

      <Grid item xs={12}>
        <Paper sx={{ p: spacing.medium }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontSize: `${fontSize.subtitle}rem` }}>Cài đặt hóa đơn</Typography>

          <TextField
            fullWidth
            label="Tiêu đề hóa đơn"
            name="invoiceTitle"
            value={settings.invoiceTitle}
            onChange={handleSettingsChange}
            sx={{ mb: spacing.medium, '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
          />

          <TextField
            fullWidth
            label="Thông báo dưới hóa đơn"
            name="invoiceNote"
            multiline
            rows={3}
            value={settings.invoiceNote}
            onChange={handleSettingsChange}
            sx={{ mb: spacing.medium, '& .MuiOutlinedInput-root': { fontSize: `${fontSize.input}rem` } }}
          />

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button variant="contained" color="primary" onClick={saveSettings} disabled={settingsLoading} sx={{ height: `${sizes.buttonHeight}px`, fontSize: `${fontSize.button}rem` }}>
              {settingsLoading ? <CircularProgress size={sizes.icon} /> : 'Lưu thay đổi'}
            </Button>
          </Box>
        </Paper>
      </Grid>
    </Grid>
  </Box>
)}
      
      {activeTab === 5 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: spacing.medium }}>
            <Typography variant="h5" sx={{ fontSize: `${fontSize.subtitle}rem` }}>QUẢN LÝ TÀI KHOẢN ADMIN</Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon sx={{ fontSize: `${sizes.icon}px` }} />}
              onClick={() => {
                setShowAdminForm(true);
                setAdminForm({
                  _id: '',
                  username: '',
                  fullName: '',
                  email: '',
                  phone: '',
                  password: '',
                  confirmPassword: '',
                  bankName: '',
                  bankAccount: '',
                  bankHolder: '',
                  momoPhone: '',
                  momoHolder: ''
                });
              }}
              sx={{ height: `${sizes.buttonHeight}px`, fontSize: `${fontSize.button}rem` }}
            >
              Thêm Admin
            </Button>
          </Box>
          
          {showAdminForm && (
            <Paper sx={{ p: spacing.medium, mb: spacing.large }}>
              <Typography variant="h6" gutterBottom sx={{ fontSize: `${fontSize.subtitle}rem` }}>
                {adminForm._id ? 'Chỉnh sửa Admin' : 'Thêm Admin mới'}
              </Typography>
            <Grid container spacing={spacing.medium}>
            
            {/* Personal Information Row */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: spacing.small, fontSize: `${fontSize.subtitle}rem`, fontWeight: 'bold' }}>
                Thông tin cá nhân
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Grid container spacing={spacing.medium}>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Tên đăng nhập"
                    name="username"
                    value={adminForm.username}
                    onChange={handleAdminFormChange}
                    required
                    sx={{ '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Họ tên"
                    name="fullName"
                    value={adminForm.fullName}
                    onChange={handleAdminFormChange}
                    required
                    sx={{ '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Email"
                    name="email"
                    type="email"
                    value={adminForm.email}
                    onChange={handleAdminFormChange}
                    required
                    sx={{ '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Số điện thoại"
                    name="phone"
                    value={adminForm.phone}
                    onChange={handleAdminFormChange}
                    sx={{ '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
                  />
                </Grid>
              </Grid>
            </Grid>

            {/* Password Fields Row (only for new admin) */}
            {!adminForm._id && (
              <>
                <Grid item xs={12}>
                  <Typography variant="subtitle1" sx={{ mt: spacing.medium, mb: spacing.small, fontSize: `${fontSize.subtitle}rem`, fontWeight: 'bold' }}>
                    Thiết lập mật khẩu
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                    <Grid container spacing={spacing.medium}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Mật khẩu"
                          name="password"
                          type="password"
                          value={adminForm.password}
                          onChange={handleAdminFormChange}
                          required
                          sx={{ '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Xác nhận mật khẩu"
                          name="confirmPassword"
                          type="password"
                          value={adminForm.confirmPassword}
                          onChange={handleAdminFormChange}
                          required
                          sx={{ '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
                        />
                      </Grid>
                    </Grid>
                  </Grid>
                </>
              )}

              {/* Bank Information Row */}
              <Grid item xs={12}>
                <Typography variant="subtitle1" sx={{ mt: spacing.medium, mb: spacing.small, fontSize: `${fontSize.subtitle}rem`, fontWeight: 'bold' }}>
                  Thông tin ngân hàng
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Grid container spacing={spacing.medium}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Tên ngân hàng"
                      name="bankName"
                      value={adminForm.bankName}
                      onChange={handleAdminFormChange}
                      sx={{ '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Số tài khoản"
                      name="bankAccount"
                      value={adminForm.bankAccount}
                      onChange={handleAdminFormChange}
                      sx={{ '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Tên chủ tài khoản"
                      name="bankHolder"
                      value={adminForm.bankHolder}
                      onChange={handleAdminFormChange}
                      sx={{ '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
                    />
                  </Grid>
                </Grid>
              </Grid>

              {/* Momo Information Row */}
              <Grid item xs={12}>
                <Typography variant="subtitle1" sx={{ mt: spacing.medium, mb: spacing.small, fontSize: `${fontSize.subtitle}rem`, fontWeight: 'bold' }}>
                  Thông tin ví Momo
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Grid container spacing={spacing.medium}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Số điện thoại Momo"
                      name="momoPhone"
                      value={adminForm.momoPhone}
                      onChange={handleAdminFormChange}
                      sx={{ '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
                    />
                  </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Tên chủ tài khoản"
                    name="momoHolder"
                    value={adminForm.momoHolder}
                    onChange={handleAdminFormChange}
                    sx={{ '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
                  />
                </Grid>
              </Grid>
            </Grid>
          </Grid>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: spacing.medium, gap: spacing.small }}>
            <Button 
              variant="outlined" 
              onClick={() => setShowAdminForm(false)}
              sx={{ height: `${sizes.buttonHeight}px`, fontSize: `${fontSize.button}rem` }}
              >
                Hủy
            </Button>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={handleAddOrUpdateAdmin}
              disabled={loading}
              sx={{ height: `${sizes.buttonHeight}px`, fontSize: `${fontSize.button}rem` }}
            >
            {loading ? <CircularProgress size={sizes.icon} /> : adminForm._id ? 'Cập nhật' : 'Thêm mới'}
            </Button>
          </Box>
        </Paper>
          )}
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: spacing.large }}>
              <CircularProgress size={sizes.icon} />
            </Box>
            ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>Tên đăng nhập</TableCell>
                    <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>Họ tên</TableCell>
                    <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>Email</TableCell>
                    <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>Số điện thoại</TableCell>
                    <TableCell sx={{ fontSize: `${fontSize.body}rem` }} align="right">Thao tác</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {admins
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((admin) => (
                      <TableRow key={admin._id}>
                        <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>{admin.username}</TableCell>
                        <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>{admin.fullName}</TableCell>
                        <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>{admin.email}</TableCell>
                        <TableCell sx={{ fontSize: `${fontSize.body}rem` }}>{admin.phone || '-'}</TableCell>
                        <TableCell align="right">
                          <IconButton 
                            color="primary" 
                            onClick={() => handleViewAdmin(admin)}
                            sx={{ p: spacing.small }}
                          >
                            <VisibilityIcon sx={{ fontSize: `${sizes.icon}px` }} />
                          </IconButton>
                          <IconButton 
                            color="primary" 
                            onClick={() => handleEditAdmin(admin)}
                            sx={{ p: spacing.small }}
                          >
                            <EditIcon sx={{ fontSize: `${sizes.icon}px` }} />
                          </IconButton>
                          {admin._id !== currentUser._id && (
                            <IconButton 
                              color="error" 
                              onClick={() => handleDeleteAdmin(admin._id)}
                              sx={{ p: spacing.small }}
                            >
                              <DeleteIcon sx={{ fontSize: `${sizes.icon}px` }} />
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              <TablePagination
                rowsPerPageOptions={[5, 10, 25]}
                component="div"
                count={admins.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                sx={{ '& .MuiTablePagination-selectLabel': { fontSize: `${fontSize.caption}rem` }, '& .MuiTablePagination-displayedRows': { fontSize: `${fontSize.caption}rem` } }}
              />
            </TableContainer>
          )}
          
          {showViewModal && viewAdmin && (
            <Modal
              open={showViewModal}
              onClose={() => setShowViewModal(false)}
              aria-labelledby="view-admin-modal"
              aria-describedby="view-admin-modal-description"
            >
              <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 400, bgcolor: 'background.paper', boxShadow: 24, p: 4 }}>
                <Typography id="view-admin-modal" variant="h6" component="h2" sx={{ fontSize: `${fontSize.subtitle}rem` }}>
                  Thông tin admin
                </Typography>
                <Typography sx={{ mt: 2, fontSize: `${fontSize.body}rem` }}>
                  <strong>Tên đăng nhập:</strong> {viewAdmin.username}
                </Typography>
                <Typography sx={{ fontSize: `${fontSize.body}rem` }}>
                  <strong>Họ tên:</strong> {viewAdmin.fullName}
                </Typography>
                <Typography sx={{ fontSize: `${fontSize.body}rem` }}>
                  <strong>Email:</strong> {viewAdmin.email}
                </Typography>
                <Typography sx={{ fontSize: `${fontSize.body}rem` }}>
                  <strong>Số điện thoại:</strong> {viewAdmin.phone || 'N/A'}
                </Typography>
                <Typography sx={{ fontSize: `${fontSize.body}rem` }}>
                  <strong>Ngân hàng:</strong> {viewAdmin.bankName || 'N/A'}
                </Typography>
                <Typography sx={{ fontSize: `${fontSize.body}rem` }}>
                  <strong>Số tài khoản:</strong> {viewAdmin.bankAccount || 'N/A'}
                </Typography>
                <Typography sx={{ fontSize: `${fontSize.body}rem` }}>
                  <strong>Chủ tài khoản:</strong> {viewAdmin.bankHolder || 'N/A'}
                </Typography>
                <Typography sx={{ fontSize: `${fontSize.body}rem` }}>
                  <strong>Số điện thoại Momo:</strong> {viewAdmin.momoPhone || 'N/A'}
                </Typography>
                <Typography sx={{ fontSize: `${fontSize.body}rem` }}>
                  <strong>Chủ tài khoản Momo:</strong> {viewAdmin.momoHolder || 'N/A'}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                  <Button onClick={() => setShowViewModal(false)} sx={{ height: `${sizes.buttonHeight}px`, fontSize: `${fontSize.button}rem` }}>
                    Đóng
                  </Button>
                </Box>
              </Box>
            </Modal>
          )}
          
          {showPasswordConfirm && (
            <Modal
              open={showPasswordConfirm}
              onClose={() => setShowPasswordConfirm(false)}
              aria-labelledby="password-confirm-modal"
              aria-describedby="password-confirm-modal-description"
            >
              <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 400, bgcolor: 'background.paper', boxShadow: 24, p: 4 }}>
                <Typography id="password-confirm-modal" variant="h6" component="h2" sx={{ fontSize: `${fontSize.subtitle}rem` }}>
                  Xác nhận mật khẩu
                </Typography>
                <Typography sx={{ mt: 2, fontSize: `${fontSize.body}rem` }}>
                  Vui lòng nhập mật khẩu của bạn để tiếp tục chỉnh sửa thông tin admin.
                </Typography>
                <TextField
                  fullWidth
                  label="Mật khẩu"
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  sx={{ mt: 2, '& .MuiOutlinedInput-root': { height: `${sizes.inputHeight}px`, fontSize: `${fontSize.input}rem` } }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, gap: 1 }}>
                  <Button onClick={() => setShowPasswordConfirm(false)} sx={{ height: `${sizes.buttonHeight}px`, fontSize: `${fontSize.button}rem` }}>
                    Hủy
                  </Button>
                  <Button variant="contained" onClick={handleConfirmPassword} disabled={loading} sx={{ height: `${sizes.buttonHeight}px`, fontSize: `${fontSize.button}rem` }}>
                    {loading ? <CircularProgress size={sizes.icon} /> : 'Xác nhận'}
                  </Button>
                </Box>
              </Box>
            </Modal>
          )}
          
          <Typography variant="body1" sx={{ mt: spacing.medium, fontStyle: 'italic', fontSize: `${fontSize.body}rem` }}>
            <strong>Lưu ý:</strong> Mỗi admin có thể cấu hình thông tin ngân hàng/Momo riêng để nhận thanh toán.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default AdminPage;