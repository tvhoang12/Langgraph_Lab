import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent, ToolNode } from '@langchain/langgraph/prebuilt';
import { Annotation, MessagesAnnotation, StateGraph, START, END } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { Pool } from 'pg';
import { BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import {
  toolXemNgayTot,
  toolDanhSachNgayTot,
  toolXemNgayTotTheoTuoiTheoViec,
  toolDanhSachNgayTotTheoTuoiTheoViec,
} from '../libs/vn_callendar';

const GraphState = Annotation.Root({
  messages: MessagesAnnotation.spec.messages,
  summary: Annotation<string>({
    reducer: (oldState, newState) => newState,
    default: () => '',
  }),
  memory: Annotation<Record<string, any>>({
    reducer: (oldState, newState) => ({ ...oldState, ...newState }),
    default: () => ({}),
  }),
});

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AgentState {
  messages: BaseMessage[];
  summary: string;
  memory: Record<string, any>;
  userId: string;
  sessionId: string;
  conversationHistory: ConversationMessage[];
  context: Record<string, unknown>;
}

export interface AgentMemoryConfig {
  sessionId: string;
  userId: string;
  maxMemorySize?: number;
}



// LLM configuration
interface LLMConfig {
  modelName: string;
  temperature: number;
  maxTokens: number;
  topP: number;
}

const DEFAULT_LLM_CONFIG: LLMConfig = {
  modelName: process.env.OPENAI_MODEL || 'gpt-4-turbo',
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.9,
};

// AI Agent Service

export const getAvailableTools = () => {
  return {
    xem_ngay_tot_am_lich_vn: toolXemNgayTot,
    xem_ngay_tot_viec_tot_am_lich_vn: toolXemNgayTotTheoTuoiTheoViec,
    danh_sach_ngay_tot_am_lich_vn: toolDanhSachNgayTot,
    danh_sach_ngay_tot_viec_tot_am_lich_vn: toolDanhSachNgayTotTheoTuoiTheoViec,
  };
};

@Injectable()
export class AiAgentService implements OnModuleInit {
  private logger = new Logger(AiAgentService.name);
  private llm: ChatOpenAI;
  private modelWithTools: any;
  private agent: any;
  private checkpointer: PostgresSaver;
  private conversationHistory: Map<string, ConversationMessage[]> = new Map();
  private sessionMemory: Map<string, { summary: string; memory: Record<string, any> }> = new Map();
  private initialized = false;
  private tools: any[] = [];

  private normalizeMessageContent(content: unknown): any {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content.map((block) => {
        if (typeof block === 'string') {
          return { type: 'text' as const, text: block };
        }

        if (block && typeof block === 'object') {
          const typedBlock = block as Record<string, unknown>;

          if (typeof typedBlock.type === 'string') {
            return typedBlock;
          }

          if (typeof typedBlock.text === 'string') {
            return { type: 'text' as const, text: typedBlock.text };
          }

          return {
            type: 'text' as const,
            text: JSON.stringify(typedBlock),
          };
        }

        return { type: 'text' as const, text: String(block ?? '') };
      });
    }

    if (content === null || content === undefined) {
      return '';
    }

    if (typeof content === 'object' && 'text' in (content as Record<string, unknown>)) {
      const contentObject = content as Record<string, unknown>;
      if (typeof contentObject.text === 'string') {
        return [{ type: 'text' as const, text: contentObject.text }];
      }
    }

    return String(content);
  }

  private normalizeMessagesForModel(messages: BaseMessage[]): BaseMessage[] {
    return messages.map((message) => {
      (message as any).content = this.normalizeMessageContent(
        message.content,
      );
      return message;
    });
  }

  constructor(private readonly configService: ConfigService) {
    this.logger.log('AiAgentService instantiated - LLM will initialize on first use');
  }

  async onModuleInit() {
    try {
      const pool = new Pool({
        host: this.configService.get<string>('DATABASE_HOST'),
        port: this.configService.get<number>('DATABASE_PORT'),
        user:
          this.configService.get<string>('DATABASE_USERNAME') ||
          this.configService.get<string>('DATABASE_USER'),
        password: this.configService.get<string>('DATABASE_PASSWORD'),
        database: this.configService.get<string>('DATABASE_NAME'),
      });
      this.checkpointer = new PostgresSaver(pool, undefined, { schema: 'app' });
      await this.checkpointer.setup();
      this.logger.log('PostgreSQL Saver initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize PostgreSQL Saver: ${error.message}`);
      throw error;
    }
  }

  //  LLM INITIALIZATION (LAZY LOADING)

  private initializeLLM(): void {
    if (this.initialized) return;

    try {
      const apiKey = process.env.OPENAI_API_KEY;

      if (!apiKey) {
        throw new Error(
          'OPENAI_API_KEY is not defined in environment variables. Please set it in .env file.',
        );
      }

      this.llm = new ChatOpenAI({
        modelName: DEFAULT_LLM_CONFIG.modelName,
        apiKey,
        temperature: DEFAULT_LLM_CONFIG.temperature,
        maxTokens: DEFAULT_LLM_CONFIG.maxTokens,
        topP: DEFAULT_LLM_CONFIG.topP,
      });

      this.logger.log('LLM initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize LLM: ${error.message}`);
      throw error;
    }
  }

  private initializeAgent(): void {
    if (this.agent) return;

    try {
      this.initializeModelWithTools();
      
      // Xây dựng agent từ StateGraph
      const workflow = this.buildAgent();
      this.agent = workflow.compile({ checkpointer: this.checkpointer });
      
      this.initialized = true;
      this.logger.log('Agent initialized with State Management');
    } catch (error) {
      this.logger.error(`Failed to initialize agent: ${error.message}`);
      throw error;
    }
  }

  private initializeModelWithTools(): void {
    const chatbot_tools = [
      toolXemNgayTot,
      toolDanhSachNgayTot,
      toolXemNgayTotTheoTuoiTheoViec,
      toolDanhSachNgayTotTheoTuoiTheoViec,
    ];

    // Lưu tools vào property
    this.tools = chatbot_tools;

    // Bind tools vào model và lưu vào property
    this.modelWithTools = this.llm.bindTools(this.tools);

    // Log danh sách tools
    const toolNames = this.tools.map((tool) => tool.name).join(', ');
    this.logger.debug('Model initialized with tools: ' + toolNames);
    this.logger.log(`Agent created with ${this.tools.length} tools: ${toolNames}`);
  }

  private buildAgent() {
    const HISTORY_LIMIT = 10;
    const SUMMARIZE_THRESHOLD = 6;
    
    return new StateGraph(GraphState)
      .addNode('agent', async (state) => {
        // Chuẩn bị system prompt với summary, memory, và user info
        const memory_str = JSON.stringify(state.memory || {});
        const lunarBirthYear = state.memory?.lunarBirthYear;
        const activity = state.memory?.activity;
        
        const userContext = `
# User Information:
${lunarBirthYear ? `- Lunar Birth Year: ${lunarBirthYear}` : ''}
${activity ? `- Activity Request: ${activity}` : ''}
${state.summary ? `- Summary: ${state.summary}` : '- Summary: No data yet'}
- Memory: ${memory_str === '{}' || memory_str === JSON.stringify({ lunarBirthYear, activity }) ? 'No context' : memory_str}`;

        const system_prompt = `You are a helpful Vietnamese AI assistant specialized in Vietnamese calendar and auspicious days.

IMPORTANT RULES:
- For questions about auspicious days (ngày tốt), lucky dates, or calendar info: ALWAYS USE TOOLS
- Do NOT answer calendar questions without using tools
- Always provide tool results to user
- If user provides birth year and/or activity, PRIORITIZE tools that accept these parameters:
  * If BOTH lunar birth year AND activity provided: Use 'xem_ngay_tot_viec_tot_am_lich_vn' or 'danh_sach_ngay_tot_viec_tot_am_lich_vn'
  * If ONLY lunar birth year: Still use activity-specific tools if calendar question is mentioned
  * Always prefer detailed personal results when user data is available

Available Tools:
1. xem_ngay_tot_am_lich_vn - Get auspicious day info for a date
2. danh_sach_ngay_tot_am_lich_vn - Find lucky days in date range
3. xem_ngay_tot_viec_tot_am_lich_vn - Check lucky day for ACTIVITY + LUNAR BIRTH YEAR
4. danh_sach_ngay_tot_viec_tot_am_lich_vn - Find lucky days for ACTIVITY in date range + LUNAR BIRTH YEAR

${userContext}

Current time: ${new Date().toLocaleString()}`;

        // Filter messages: remove old SystemMessages, use current one
        const filtered_messages = state.messages.filter(
          (msg) => !(msg instanceof SystemMessage),
        );

        // Chuẩn bị messages với SystemMessage once
        const messages_to_invoke = this.normalizeMessagesForModel([
          new SystemMessage(system_prompt),
          ...filtered_messages,
        ]);

        // Gọi model với tools binding
        const response = await this.modelWithTools.invoke(messages_to_invoke);
        
        // Kiểm tra và thực hiện summarization nếu cần
        let new_summary = state.summary;
        let new_messages = [...state.messages, response];
        
        if (new_messages.length > SUMMARIZE_THRESHOLD) {
          try {
            new_summary = await this.summarizeMessages(
              new_messages.slice(0, -2),
              state.summary,
            );
            // Giữ lại 2 messages cuối
            new_messages = new_messages.slice(-2);
          } catch (error) {
            this.logger.error(`Summarization error: ${error.message}`);
          }
        }
        
        return { 
          messages: [response],
          summary: new_summary,
        };
      })
      .addNode('tools', async (state) => {
        // Thực thi tools - ensure tool responses are properly formatted
        const tool_node = new ToolNode(this.tools);
        // ToolNode.invoke expects state with messages array
        const normalized_state_messages = this.normalizeMessagesForModel(state.messages);
        const result = await tool_node.invoke({ messages: normalized_state_messages });
        
        // Ensure tool responses have proper type for OpenAI API
        if (result.messages) {
          result.messages = result.messages.map((msg) => {
            if (msg instanceof ToolMessage) {
              return new ToolMessage({
                content: this.normalizeMessageContent(msg.content),
                tool_call_id: msg.tool_call_id,
              });
            }
            return msg;
          });
        }
        return result;
      })
      .addEdge(START, 'agent')
      .addConditionalEdges('agent', (state) => {
        const last_msg = state.messages[state.messages.length - 1] as AIMessage;
        if (last_msg.tool_calls && last_msg.tool_calls.length > 0) {
          return 'tools';
        }
        return END;
      })
      .addEdge('tools', 'agent');
  }
  
  private async summarizeMessages(
    messages: BaseMessage[],
    oldSummary: string,
  ): Promise<string> {
    try {
      const summary_prompt = oldSummary
        ? `Đây là bản tóm tắt cũ: ${oldSummary}\n\nHãy cập nhật bản tóm tắt này bao gồm thêm cả các diễn biến mới quan trọng từ các tin nhắn sau:`
        : 'Hãy tạo một bản tóm tắt ngắn gọn và đầy đủ về cuộc hội thoại sau:';

      const chat_content = messages
        .map((m) => {
          if (m instanceof HumanMessage) return `User: ${m.content}`;
          if (m instanceof AIMessage) return `AI: ${m.content}`;
          return '';
        })
        .filter(Boolean)
        .join('\n');

      const response = await this.llm.invoke([
        new SystemMessage(
          'Bạn là chuyên gia quản lý bộ nhớ. Hãy tóm tắt hội thoại bằng Tiếng Việt, giữ lại các thông tin cốt lõi (vấn đề đang hỏi, kết luận, tên người dùng, sở thích). Đừng tóm tắt quá chi tiết các câu chào hỏi.',
        ),
        new HumanMessage(`${summary_prompt}\n\n${chat_content}`),
      ]);

      return response.content as string;
    } catch (error) {
      this.logger.error(`Error summarizing messages: ${error.message}`);
      return oldSummary;
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.initializeLLM();
      this.initializeAgent();
    }
  }

  async invokeAgent(
    input: string,
    threadId: string,
    lunarBirthYear?: number,
    activity?: string,
  ) {
    try {
      this.ensureInitialized();
      
      // Lấy session memory (summary & memory)
      const { summary, memory } = this.getSessionMemory(threadId);
      
      const result = await this.agent.invoke(
        { 
          messages: [new HumanMessage(input)],
          summary: summary,
          memory: { ...memory, lunarBirthYear, activity },
        },
        { configurable: { thread_id: threadId } },
      );
      
      // Extract summary và memory từ result
      let new_summary = result.summary || summary;
      const new_memory = result.memory || memory;
      
      // Thực hiện summarization nếu cần (AWAIT - không background)
      if (result.messages && result.messages.length > 6) {
        try {
          new_summary = await this.summarizeMessages(
            result.messages.slice(0, -2),
            new_summary,
          );
        } catch (error) {
          this.logger.error(`Summarization error: ${error.message}`);
        }
      }
      
      // Cập nhật session memory
      this.updateSessionMemory(threadId, {
        summary: new_summary,
        memory: new_memory,
      });
      
      this.logger.debug(`Agent invoked for thread ${threadId} with input: ${input}`);
      
      // Return kết quả kèm theo full state (messages, summary, memory)
      return {
        ...result,
        state: {
          messages: result.messages || [],
          summary: new_summary,
          memory: new_memory,
        },
      };
    } catch (error) {
      this.logger.error(`Agent invocation failed: ${error.message}`);
      throw error;
    }
  }

  getLLM(): ChatOpenAI {
    this.ensureInitialized();
    return this.llm;
  }

  getLLMConfig(): LLMConfig {
    return DEFAULT_LLM_CONFIG;
  }

  getAgent() {
    this.ensureInitialized();
    return this.agent;
  }

  getAgentTools() {
    this.ensureInitialized();
    return this.tools;
  }

  getAgentToolsInfo() {
    this.ensureInitialized();
    return this.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
  }

  //  MEMORY MANAGEMENT 

  private getSessionMemory(sessionId: string) {
    if (!this.sessionMemory.has(sessionId)) {
      this.sessionMemory.set(sessionId, { summary: '', memory: {} });
    }
    return this.sessionMemory.get(sessionId)!;
  }

  private updateSessionMemory(
    sessionId: string,
    updates: { summary?: string; memory?: Record<string, any> },
  ): void {
    const session = this.getSessionMemory(sessionId);
    if (updates.summary !== undefined) {
      session.summary = updates.summary;
    }
    if (updates.memory !== undefined) {
      session.memory = { ...session.memory, ...updates.memory };
    }
    this.logger.debug(`Session memory updated for ${sessionId}`);
  }

  async getSessionState(sessionId: string) {
    const { summary, memory } = this.getSessionMemory(sessionId);
    return { summary, memory };
  }

  async initializeMemory(config: AgentMemoryConfig): Promise<void> {
    const { sessionId } = config;

    if (!this.conversationHistory.has(sessionId)) {
      this.conversationHistory.set(sessionId, []);
      this.logger.log(`Memory initialized for session: ${sessionId}`);
    }
  }

  async addUserMessage(
    sessionId: string,
    content: string,
  ): Promise<void> {
    const history = this.conversationHistory.get(sessionId) || [];
    history.push({
      role: 'user',
      content,
      timestamp: new Date(),
    });
    this.conversationHistory.set(sessionId, history);
    this.logger.debug(`User message added to session: ${sessionId}`);
  }

  async addAssistantMessage(
    sessionId: string,
    content: string,
  ): Promise<void> {
    const history = this.conversationHistory.get(sessionId) || [];
    history.push({
      role: 'assistant',
      content,
      timestamp: new Date(),
    });
    this.conversationHistory.set(sessionId, history);
    this.logger.debug(`Assistant message added to session: ${sessionId}`);
  }

  async getHistory(sessionId: string): Promise<ConversationMessage[]> {
    return this.conversationHistory.get(sessionId) || [];
  }

  async clearMemory(sessionId: string): Promise<void> {
    this.conversationHistory.delete(sessionId);
    this.logger.log(`Memory cleared for session: ${sessionId}`);
  }

  async clearAllMemories(): Promise<void> {
    this.conversationHistory.clear();
    this.logger.log('All memories cleared');
  }
}