import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS with proper configuration
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
  });

  const PORT = process.env.PORT || 3001;

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('ChatAIAgent - Calendar API')
    .setDescription(
      'API for AI-powered Vietnamese calendar and appointment scheduling chatbot',
    )
    .setVersion('1.0.0')
    .addServer(`http://localhost:${PORT}`, 'Development')
    .addTag('Chatbot Calendar', 'Chatbot Calendar endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  await app.listen(PORT);
  console.log(`🚀 Application is running on: http://localhost:${PORT}`);
  console.log(`📚 Swagger UI available at: http://localhost:${PORT}/api`);
}

bootstrap();
