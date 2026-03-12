import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ChatbotCallendarModule } from './chatbot-callendar/chatbot-callendar.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MikroOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        driver: require('@mikro-orm/postgresql').PostgreSqlDriver,
        host: configService.get<string>('DATABASE_HOST', 'localhost'),
        port: configService.get<number>('DATABASE_PORT', 5432),
        user: configService.get<string>('DATABASE_USER', 'admin'),
        password: configService.get<string>('DATABASE_PASSWORD', 'admin123'),
        dbName: configService.get<string>('DATABASE_NAME', 'bot_history'),
        entities: ['dist/**/*.entity.js'],
        entitiesTs: ['src/**/*.entity.ts'],
        debug: configService.get<string>('NODE_ENV') === 'development',
        autoloadEntities: true,
        migrations: {
          path: 'dist/migrations',
          pathTs: 'src/migrations',
        },
      }),
    }),
    ChatbotCallendarModule,
  ],
})
export class AppModule {}
