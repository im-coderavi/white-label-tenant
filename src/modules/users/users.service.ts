import { User, UserDocument } from '../../models/User';

export async function listUsersForTenant(tenantId: string): Promise<UserDocument[]> {
  return User.find({ tenantId }).select('-passwordHash');
}
