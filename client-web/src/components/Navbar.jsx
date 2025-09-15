import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { AppBar, Toolbar, Typography, Button, Box, IconButton } from '@mui/material';
import { ShoppingCart, ExitToApp, Person, Store } from '@mui/icons-material';
import { Person as PersonIcon } from '@mui/icons-material';

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const { clearCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  // Kiểm tra xem có nên hiển thị Navbar không
  const routesWithoutNavbar = ['/', '/register', '/auth'];
  const shouldHideNavbar = routesWithoutNavbar.includes(location.pathname);

  const handleLogout = async () => {
    try {
      clearCart();
      logout();
      navigate('/login');
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (shouldHideNavbar) {
    return null;
  }

  return (
    <AppBar position="static" color="default" elevation={0} sx={{ bgcolor: 'background.paper' }}>
      <Toolbar sx={{ 
        minHeight: '48px !important', 
        px: 1,
        justifyContent: 'space-between'
      }}>
        {/* Phần bên trái: Logo và tên ứng dụng */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Store sx={{ 
            fontSize: '1.2rem', 
            mr: 0.5,
            color: 'primary.main'
          }} />
          <Typography 
            variant="subtitle1" 
            component={Link} 
            to="/shopping" 
            sx={{ 
              textDecoration: 'none', 
              color: 'inherit',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              letterSpacing: '-0.5px'
            }}
          >
            SMART MARKET
          </Typography>
        </Box>

        {/* Phần giữa: Thông tin người dùng (chỉ hiển thị trên desktop) */}
        {currentUser && !currentUser.isGuest && !currentUser.isAdmin && (
          <Box 
            sx={{ 
              display: { xs: 'none', sm: 'flex' },
              alignItems: 'center',
              mx: 1
            }}
          >
            <Person sx={{ fontSize: '0.9rem', mr: 0.75 }} />
            <Typography 
              variant="caption" 
              component={Link} 
              to="/userpage"
              sx={{ 
                mr: 1,
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '80px'
              }}
            >
              {currentUser.fullName}
            </Typography>
            <Typography 
              variant="caption" 
              color="secondary" 
              sx={{ 
                fontWeight: 'bold',
                fontSize: '0.75rem'
              }}
            >
              {currentUser.points}đ
            </Typography>
          </Box>
        )}

        {/* Phần bên phải: Các nút chức năng */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {/* Nút quản trị (nếu là admin) */}
          {currentUser?.isAdmin && (
            <Button 
              color="inherit" 
              component={Link} 
              to="/admin"
              sx={{ 
                mr: 0.5,
                fontSize: '0.7rem',
                padding: '4px 6px',
                minWidth: 'auto'
              }}
            >
              Quản trị
            </Button>
          )}

          {/* Nút giỏ hàng */}
          <IconButton 
            color="inherit" 
            component={Link} 
            to="/shopping"
            size="small"
            sx={{ 
              mr: 0.5,
              padding: '6px'
            }}
          >
            <ShoppingCart sx={{ fontSize: '1.1rem' }} />
          </IconButton>

          {/* Nút đăng nhập/đăng xuất */}
          {currentUser ? (
            <Button 
              color="inherit" 
              onClick={handleLogout}
              size="small"
              sx={{
                fontSize: '0.7rem',
                padding: '4px 6px',
                minWidth: 'auto'
              }}
              startIcon={<ExitToApp sx={{ fontSize: '0.9rem' }} />}
            >
              Thoát
            </Button>
          ) : (
            <Button 
              color="inherit" 
              component={Link} 
              to="/login"
              size="small"
              sx={{
                fontSize: '0.7rem',
                padding: '4px 6px',
                minWidth: 'auto'
              }}
              startIcon={<ExitToApp sx={{ fontSize: '0.9rem' }} />}
            >
              Đăng nhập
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;