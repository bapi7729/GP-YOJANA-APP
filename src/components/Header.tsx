import React from 'react';
import { AppBar, Toolbar, Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import LanguageSwitcher from './language-switcher';

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: '#f8f9fa',
  boxShadow: 'none',
  borderBottom: '1px solid #e9ecef',
}));

const Header = () => {
  return (
    <StyledAppBar position="sticky">
      <Toolbar>
        <Box display="flex" justifyContent="center" alignItems="center" width="100%">
          <LanguageSwitcher />
        </Box>
      </Toolbar>
    </StyledAppBar>
  );
};

export default Header; 