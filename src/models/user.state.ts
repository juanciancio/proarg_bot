import { UserModel } from './user.model';

export interface UserState {
  currentStep: number;
  userInfo: UserModel;
}
