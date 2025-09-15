import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Box, Container, Paper, Typography, Grid, TextField, Button, IconButton,
  List, ListItem, ListItemText, Divider, CircularProgress, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Select,
  FormControl, InputLabel, Snackbar, Alert, Collapse, Card, CardContent
} from '@mui/material';
import { 
  Download as DownloadIcon, 
  Edit as EditIcon, 
  Person as PersonIcon,
  Payment as PaymentIcon,
  History as HistoryIcon,
  AccountBalance as BankIcon,
  Phone as PhoneIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const UserPage = () => {
  const { currentUser } = useAuth();
  const token = localStorage.getItem('token');

  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editProfile, setEditProfile] = useState({
    fullName: '',
    email: '',
    phone: '',
    bankName: '',
    bankAccount: '',
    bankHolder: '',
    momoPhone: '',
    momoHolder: ''
  });
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    if (currentUser && token) {
      fetchUserData();
    }
  }, [currentUser, token]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchProfile(), fetchOrders()]);
    } catch (err) {
      console.error('Failed to load user data', err);
      setSnack({ open: true, message: 'Không thể tải dữ liệu người dùng', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      // Sử dụng endpoint auth/user có sẵn trong auth.js
      const res = await axios.get(`${BACKEND_URL}/api/auth/user`, {
        headers: { 
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        }
      });
      setProfile(res.data);
      setEditProfile({
        fullName: res.data.fullName || '',
        email: res.data.email || '',
        phone: res.data.phone || '',
        bankName: res.data.bankName || '',
        bankAccount: res.data.bankAccount || '',
        bankHolder: res.data.bankHolder || '',
        momoPhone: res.data.momoPhone || '',
        momoHolder: res.data.momoHolder || ''
      });
    } catch (err) {
      console.error('Lỗi khi tải profile:', err);
      // Fallback sử dụng currentUser
      if (currentUser) {
        const userData = {
          id: currentUser.id || currentUser._id,
          username: currentUser.username,
          fullName: currentUser.fullName || '',
          email: currentUser.email || '',
          phone: currentUser.phone || '',
          isAdmin: currentUser.isAdmin || false,
          bankName: currentUser.bankName || '',
          bankAccount: currentUser.bankAccount || '',
          bankHolder: currentUser.bankHolder || '',
          momoPhone: currentUser.momoPhone || '',
          momoHolder: currentUser.momoHolder || ''
        };
        setProfile(userData);
        setEditProfile({
          fullName: userData.fullName,
          email: userData.email,
          phone: userData.phone,
          bankName: userData.bankName,
          bankAccount: userData.bankAccount,
          bankHolder: userData.bankHolder,
          momoPhone: userData.momoPhone,
          momoHolder: userData.momoHolder
        });
      }
    }
  };

  const fetchOrders = async () => {
    try {
      // Sử dụng endpoint orders/myorders có sẵn trong orders.js
      const res = await axios.get(`${BACKEND_URL}/api/orders/myorders`, {
        headers: { 
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        }
      });
      setOrders(res.data || []);
    } catch (err) {
      console.error('Lỗi khi tải orders:', err);
      setOrders([]);
    }
  };

  const handleUpdateProfile = async () => {
    if (!token || !profile) return;
    
    setSaving(true);
    try {
      // Giả sử có endpoint PUT /auth/user hoặc /users/:id để update profile
      const res = await axios.put(`${BACKEND_URL}/api/auth/user`, editProfile, {
        headers: { 
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        }
      });
      
      setProfile({ ...profile, ...editProfile });
      setOpenEditDialog(false);
      setSnack({ open: true, message: 'Cập nhật thông tin thành công', severity: 'success' });
    } catch (err) {
      console.error('Lỗi cập nhật profile:', err);
      setSnack({ open: true, message: 'Cập nhật thất bại', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadInvoice = async (orderId) => {
    if (!token) {
      setSnack({ open: true, message: 'Bạn chưa đăng nhập', severity: 'warning' });
      return;
    }
    
    try {
      // Sử dụng endpoint bill/:id/invoice có sẵn trong bill.js
      const res = await axios.get(`${BACKEND_URL}/api/bill/${orderId}/invoice`, {
        headers: { 
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        },
        responseType: 'blob'
      });
      
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `hoa_don_${orderId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setSnack({ open: true, message: 'Tải hóa đơn thành công', severity: 'success' });
    } catch (err) {
      console.error('Không thể tải hóa đơn:', err);
      setSnack({ 
        open: true, 
        message: err.response?.status === 404 ? 'Không tìm thấy hóa đơn' : 'Không thể tải hóa đơn', 
        severity: 'error' 
      });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'success';
      case 'pending': return 'warning';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'paid': return 'Hoàn thành';
      case 'pending': return 'Đang xử lý';
      case 'cancelled': return 'Đã hủy';
      default: return 'Không xác định';
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Đang tải thông tin người dùng...
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
        Thông tin tài khoản
      </Typography>

      <Grid container spacing={3}>
        {/* Profile Information */}
        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                  <PersonIcon sx={{ mr: 1 }} />
                  Thông tin cá nhân
                </Typography>
                <Button 
                  size="small" 
                  startIcon={<EditIcon />} 
                  onClick={() => setOpenEditDialog(true)}
                >
                  Chỉnh sửa
                </Button>
              </Box>

              <Box sx={{ '& > div': { mb: 2 } }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Tên đăng nhập
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {profile?.username || '—'}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Họ và tên
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {profile?.fullName || '—'}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Email
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {profile?.email || '—'}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Số điện thoại
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {profile?.phone || '—'}
                  </Typography>
                </Box>

                {profile?.isAdmin && (
                  <Chip 
                    label="Quản trị viên" 
                    color="primary" 
                    size="small" 
                  />
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <PaymentIcon sx={{ mr: 1 }} />
                Thông tin thanh toán
              </Typography>

              <Box sx={{ '& > div': { mb: 2 } }}>
                {/* Bank Info */}
                {(profile?.bankName || profile?.bankAccount) && (
                  <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <BankIcon sx={{ mr: 1, fontSize: 16 }} />
                      Ngân hàng
                    </Typography>
                    <Typography variant="body2">
                      {profile?.bankName || '—'}
                    </Typography>
                    <Typography variant="body2">
                      STK: {profile?.bankAccount || '—'}
                    </Typography>
                    <Typography variant="body2">
                      Chủ TK: {profile?.bankHolder || '—'}
                    </Typography>
                  </Box>
                )}

                {/* MoMo Info */}
                {(profile?.momoPhone || profile?.momoHolder) && (
                  <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <PhoneIcon sx={{ mr: 1, fontSize: 16 }} />
                      MoMo
                    </Typography>
                    <Typography variant="body2">
                      SĐT: {profile?.momoPhone || '—'}
                    </Typography>
                    <Typography variant="body2">
                      Chủ TK: {profile?.momoHolder || '—'}
                    </Typography>
                  </Box>
                )}

                {!profile?.bankName && !profile?.momoPhone && (
                  <Typography variant="body2" color="text.secondary">
                    Chưa có thông tin thanh toán
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Order History */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                  <HistoryIcon sx={{ mr: 1 }} />
                  Lịch sử đơn hàng ({orders.length})
                </Typography>
                <Button size="small" onClick={fetchOrders}>
                  Làm mới
                </Button>
              </Box>

              {orders.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    Bạn chưa có đơn hàng nào
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ maxHeight: 600, overflowY: 'auto' }}>
                  {orders.map((order) => (
                    <Paper 
                      key={order._id} 
                      variant="outlined" 
                      sx={{ mb: 2, p: 2 }}
                    >
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={8}>
                          <Typography variant="subtitle1" fontWeight="medium">
                            Đơn hàng #{order._id}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {new Date(order.createdAt).toLocaleString('vi-VN')}
                          </Typography>
                          <Typography variant="h6" color="primary" sx={{ mt: 1 }}>
                            {Number(order.total || 0).toLocaleString('vi-VN')}₫
                          </Typography>
                          <Chip 
                            label={getStatusText(order.status)} 
                            color={getStatusColor(order.status)}
                            size="small"
                            sx={{ mt: 1 }}
                          />
                        </Grid>

                        <Grid item xs={12} md={4} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                          <Button
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            onClick={() => handleDownloadInvoice(order._id)}
                            size="small"
                            fullWidth
                          >
                            Tải hóa đơn
                          </Button>
                        </Grid>

                        {/* Order Items */}
                        {order.items && order.items.length > 0 && (
                          <Grid item xs={12}>
                            <Divider sx={{ my: 1 }} />
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                              Sản phẩm đã mua:
                            </Typography>
                            <List dense>
                              {order.items.slice(0, 3).map((item, idx) => (
                                <ListItem key={idx} sx={{ py: 0.5, px: 0 }}>
                                  <ListItemText
                                    primary={
                                      <Typography variant="body2">
                                        {item.name || (item.product?.name) || 'Sản phẩm không xác định'}
                                        {item.isWeighted && item.weightGrams && ` (${item.weightGrams}g)`}
                                      </Typography>
                                    }
                                    secondary={
                                      <Typography variant="caption" color="text.secondary">
                                        {item.quantity}x {Number(item.price || 0).toLocaleString('vi-VN')}₫ = {
                                          Number((item.price || 0) * (item.quantity || 1)).toLocaleString('vi-VN')
                                        }₫
                                      </Typography>
                                    }
                                  />
                                </ListItem>
                              ))}
                              {order.items.length > 3 && (
                                <ListItem sx={{ py: 0, px: 0 }}>
                                  <ListItemText
                                    primary={
                                      <Typography variant="caption" color="text.secondary">
                                        ... và {order.items.length - 3} sản phẩm khác
                                      </Typography>
                                    }
                                  />
                                </ListItem>
                              )}
                            </List>
                          </Grid>
                        )}
                      </Grid>
                    </Paper>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Edit Profile Dialog */}
      <Dialog 
        open={openEditDialog} 
        onClose={() => setOpenEditDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Chỉnh sửa thông tin cá nhân</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Họ và tên"
              value={editProfile.fullName}
              onChange={(e) => setEditProfile({ ...editProfile, fullName: e.target.value })}
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={editProfile.email}
              onChange={(e) => setEditProfile({ ...editProfile, email: e.target.value })}
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              label="Số điện thoại"
              value={editProfile.phone}
              onChange={(e) => setEditProfile({ ...editProfile, phone: e.target.value })}
              sx={{ mb: 3 }}
            />

            <Typography variant="h6" sx={{ mb: 2 }}>Thông tin thanh toán</Typography>
            
            <TextField
              fullWidth
              label="Tên ngân hàng"
              value={editProfile.bankName}
              onChange={(e) => setEditProfile({ ...editProfile, bankName: e.target.value })}
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              label="Số tài khoản"
              value={editProfile.bankAccount}
              onChange={(e) => setEditProfile({ ...editProfile, bankAccount: e.target.value })}
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              label="Chủ tài khoản"
              value={editProfile.bankHolder}
              onChange={(e) => setEditProfile({ ...editProfile, bankHolder: e.target.value })}
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              label="Số điện thoại MoMo"
              value={editProfile.momoPhone}
              onChange={(e) => setEditProfile({ ...editProfile, momoPhone: e.target.value })}
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              label="Chủ tài khoản MoMo"
              value={editProfile.momoHolder}
              onChange={(e) => setEditProfile({ ...editProfile, momoHolder: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditDialog(false)}>
            Hủy
          </Button>
          <Button 
            onClick={handleUpdateProfile} 
            variant="contained" 
            disabled={saving}
          >
            {saving ? <CircularProgress size={20} /> : 'Cập nhật'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnack({ ...snack, open: false })} 
          severity={snack.severity}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default UserPage;