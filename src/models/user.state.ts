import { UserModel } from './user.model';

export interface UserState {
  currentStep: number;
  cooldownUploadBet: number;
  userInfo: UserModel;
}
