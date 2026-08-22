import { SocketIOChatTransport } from './SocketIOChatTransport';
import type { IChatTransport } from './IChatTransport';

export const chatTransport: IChatTransport = new SocketIOChatTransport();
