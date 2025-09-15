// AuthPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Box, Tabs, Tab, Typography, TextField, Button, Grid, Paper, 
  Alert, CircularProgress, useTheme, useMediaQuery
} from '@mui/material';
import { 
  Lock as LockIcon, 
  QrCodeScanner as QrIcon, 
  PersonAdd as PersonAddIcon, 
  Person as GuestIcon 
} from '@mui/icons-material';
import { QRCodeSVG as QRCode } from 'qrcode.react';

// thêm imports cho radio
import FormControl from '@mui/material/FormControl';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';

const AuthPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [registerData, setRegisterData] = useState({ 
    fullName: '', email: '', phone: '', username: '', password: '', confirmPassword: '' 
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qrSize, setQrSize] = useState(100);
  
  // thêm role state ('user' | 'admin' | 'guest')
  const [role, setRole] = useState('user');

  const { login, loginAdmin, register, continueAsGuest } = useAuth();
  const navigate = useNavigate();
  
  // Material-UI responsive hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Dynamic QR code size based on screen size
  useEffect(() => {
    const updateQrSize = () => {
      if (window.innerWidth < 480) {
        setQrSize(70);
      } else if (window.innerWidth < 768) {
        setQrSize(90);
      } else {
        setQrSize(100);
      }
    };
    
    updateQrSize();
    window.addEventListener('resize', updateQrSize);
    return () => window.removeEventListener('resize', updateQrSize);
  }, []);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setError('');
  };

  const handleLoginChange = (e) => {
    setLoginData({ ...loginData, [e.target.name]: e.target.value });
  };

  const handleRegisterChange = (e) => {
    setRegisterData({ ...registerData, [e.target.name]: e.target.value });
  };

  const handleSubmitLogin = async () => {
    // Nếu role là guest, thì vào luôn không cần kiểm tra username/password
    if (role === 'guest') {
      continueAsGuest();
      navigate('/shopping');
      return;
    }

    // Với role user và admin, vẫn cần kiểm tra username/password
    if (!loginData.username || !loginData.password) {
      setError('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    try {
      setLoading(true);
      setError('');
      if (role === 'admin') {
        await loginAdmin(loginData.username, loginData.password);
        navigate('/admin');
      } else {
        await login(loginData.username, loginData.password);
        navigate('/shopping');
      }
    } catch (err) {
      setError(err?.response?.data?.message || (role === 'admin' ? 'Đăng nhập admin thất bại' : 'Đăng nhập thất bại'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    const { fullName, email, phone, username, password, confirmPassword } = registerData;
    
    if (!fullName || !email || !phone || !username || !password || !confirmPassword) {
      setError('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    try {
      setLoading(true);
      await register({ fullName, email, phone, username, password });
      setError('');
      setActiveTab(0);
    } catch (err) {
      setError('Đăng ký thất bại. Tài khoản có thể đã tồn tại');
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = () => {
    continueAsGuest();
    navigate('/shopping');
  };

  // Define registration fields with 2 columns layout
  const registerFields = [
    { id: 'fullName', label: 'Họ và tên', type: 'text' },
    { id: 'username', label: 'Tên đăng nhập', type: 'text' },
    { id: 'email', label: 'Email', type: 'email' },
    { id: 'password', label: 'Mật khẩu', type: 'password' },
    { id: 'phone', label: 'Số điện thoại', type: 'text' },
    { id: 'confirmPassword', label: 'Xác nhận mật khẩu', type: 'password' },
  ];

  return (
    <Box 
      className="auth-container" 
      sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh', 
        bgcolor: 'background.default',
        p: 1
      }}
    >
      <Paper 
        className="auth-paper" 
        elevation={3}
        sx={{ 
          width: '100%', 
          maxWidth: { xs: '95%', sm: 500, md: 600, lg: 700 },
          p: { xs: 2, sm: 3, md: 4 }
          }}
        >
        <Typography 
          variant="h6" 
          align="center" 
          gutterBottom 
          sx={{ 
            fontWeight: 'bold', 
            color: 'primary.main',
            fontSize: '1rem'
          }}
        >
          <LockIcon sx={{ 
            verticalAlign: 'middle', 
            fontSize: '1rem',
            mr: 0.5
          }} />
          ĐĂNG NHẬP
        </Typography>

        <Typography 
          variant="body2" 
          align="center" 
          color="textSecondary" 
          sx={{ 
            mb: 1.5,
            fontSize: '0.7rem'
          }}
        >
          Chào mừng bạn đến với Smart Supermarket
        </Typography>

        <Tabs 
          className="auth-tabs" 
          value={activeTab} 
          onChange={handleTabChange} 
          variant="fullWidth" 
          sx={{ 
            mb: 1,
            '& .MuiTab-root': {
              fontSize: '0.65rem',
              minHeight: 32,
              padding: '4px 6px'
            }
          }}
        >
          <Tab 
            label="Đăng nhập" 
            icon={<LockIcon sx={{ fontSize: '0.8rem' }} />} 
          />
          <Tab 
            label="Đăng ký" 
            icon={<PersonAddIcon sx={{ fontSize: '0.8rem' }} />} 
          />
        </Tabs>

        {error && (
          <Alert severity="error" sx={{ mb: 1, fontSize: '0.65rem' }}>
            {error}
          </Alert>
        )}

        {activeTab === 0 ? (
          <Box>
            {/* Radio chọn vai trò (user / admin / guest) */}
            <FormControl component="fieldset" sx={{ mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RadioGroup
                row
                name="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                sx={{ fontSize: '0.75rem' }}
              >
                <FormControlLabel value="user" control={<Radio size="small" />} label={<Typography sx={{ fontSize: '0.75rem' }}>Người dùng</Typography>} />
                <FormControlLabel value="admin" control={<Radio size="small" />} label={<Typography sx={{ fontSize: '0.75rem' }}>Quản trị viên</Typography>} />
                <FormControlLabel value="guest" control={<Radio size="small" />} label={<Typography sx={{ fontSize: '0.75rem' }}>Khách</Typography>} />
              </RadioGroup>
            </FormControl>

            {/* Chỉ hiển thị form username/password khi không phải guest */}
            {role !== 'guest' && (
              <>
                <TextField
                  fullWidth
                  label="Tên đăng nhập"
                  name="username"
                  value={loginData.username}
                  onChange={handleLoginChange}
                  margin="dense"
                  variant="outlined"
                  size="small"
                  sx={{ mb: 0.8 }}
                />
                <TextField
                  fullWidth
                  label="Mật khẩu"
                  name="password"
                  type="password"
                  value={loginData.password}
                  onChange={handleLoginChange}
                  margin="dense"
                  variant="outlined"
                  size="small"
                  sx={{ mb: 0.8 }}
                />
              </>
            )}

            {/* Thông báo cho guest */}
            {role === 'guest' && (
              <Alert severity="info" sx={{ mb: 1, fontSize: '0.65rem' }}>
                Bạn đã chọn vào với tư cách khách. Nhấn "Đăng Nhập" để tiếp tục.
              </Alert>
            )}

            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={handleSubmitLogin}
              disabled={loading}
              sx={{ 
                mt: 1, 
                py: 0.6,
                fontSize: '0.75rem'
              }}
            >
              {loading ? <CircularProgress size={16} /> : 
                role === 'guest' ? 'ĐĂNG NHẬP' : 'Đăng Nhập'}
            </Button>
          </Box>
        ) : activeTab === 1 ? (
        <Box>
            <Grid container spacing={1} sx={{ marginTop: '-8px' }} justifyContent="center">
                {registerFields.map((field) => (
                    <Grid item xs={12} sm={6} key={field.id}>
                        <TextField
                            fullWidth
                            label={field.label}
                            name={field.id}
                            type={field.type}
                            value={registerData[field.id]}
                            onChange={handleRegisterChange}
                            margin="dense" 
                            variant="outlined"
                            size="small"
                            sx={{
                                mb: 0.8,
                                '& .MuiInputLabel-root': { fontSize: '0.8rem' },
                                marginBottom: '3px' 
                            }}
                            />
                        </Grid>
                    ))}
                </Grid>
            
            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={handleRegister}
              disabled={loading}
              sx={{ 
                mt: 0.8, 
                py: 0.6,
                fontSize: '0.75rem'
              }}
            >
              {loading ? <CircularProgress size={16} /> : 'Đăng Ký'}
            </Button>
            <Button
              fullWidth
              variant="outlined"
              color="secondary"
              onClick={() => setActiveTab(0)}
              sx={{ 
                mt: 0.8,
                py: 0.5,
                fontSize: '0.75rem'
              }}
            >
              Quay lại đăng nhập
            </Button>
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center' }}>
            <Typography 
              variant="body2" 
              gutterBottom
              sx={{ fontSize: '0.7rem' }}
            >
              Quét mã QR để đăng nhập
            </Typography>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              my: 1
            }}>
              <QRCode 
                value="smart-supermarket-qr-login" 
                size={qrSize}
              />
            </Box>
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => setActiveTab(0)}
              sx={{ 
                mt: 0.5,
                fontSize: '0.7rem',
                py: 0.4
              }}
            >
              Quay lại đăng nhập
            </Button>
          </Box>
        )}

      </Paper>
    </Box>
  );
};

export default AuthPage;