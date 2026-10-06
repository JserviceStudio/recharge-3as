import { createClient } from '@supabase/supabase-js';
// @ts-ignore
import ws from 'ws';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    transport: ws as any,
  },
  global: {
    WebSocket: ws as any,
  }
});

async function createAdmin() {
  const email = 'u96937864@3asrecharge.app';
  const password = 'Jm96937864@1';

  console.log('Creating user:', email);
  
  const { data: user, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    if (error.message.includes('already exists')) {
      console.log('User already exists, updating password...');
      const { data: usersData } = await supabase.auth.admin.listUsers();
      const existingUser = usersData.users.find((u: any) => u.email === email);
      if (existingUser) {
        await supabase.auth.admin.updateUserById(existingUser.id, { password });
        await assignRole(existingUser.id);
      }
    } else {
      console.error('Error creating user:', error);
    }
    return;
  }

  console.log('User created:', user.user.id);
  await assignRole(user.user.id);
}

async function assignRole(userId: string) {
  const { error } = await supabase.from('user_roles').upsert({ user_id: userId, role: 'admin' });
  if (error) console.error('Error assigning role:', error);
  else console.log('Role assigned successfully.');
}

createAdmin();
