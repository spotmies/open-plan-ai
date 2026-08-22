import { SocketIOAiAssistantTransport } from './SocketIOAiAssistantTransport';
import type { IAiAssistantTransport } from './IAiAssistantTransport';

export const aiAssistantTransport: IAiAssistantTransport = new SocketIOAiAssistantTransport();
export type { IAiAssistantTransport, Unsubscribe } from './IAiAssistantTransport';
