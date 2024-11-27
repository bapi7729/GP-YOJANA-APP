import { styled } from '@mui/material/styles';
import { Box, Button } from '@mui/material';

export const NavButton = styled(Button)<{ active?: boolean }>(({ theme, active }) => ({
  backgroundColor: active ? theme.palette.primary.main : 'transparent',
  color: active ? 'white' : theme.palette.text.primary,
  '&:hover': {
    backgroundColor: active ? theme.palette.primary.dark : theme.palette.action.hover,
  },
}));

export const VillageSelector = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
})); 