import { callPlatformApi } from '../common/utils/request';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { CustomLogger } from '../common/logger/custom.logger';

const logger = new CustomLogger();
logger.setContext('VnCalendar');

export enum Viec {
  KHOI_CONG = 'Khởi công',
  VE_NHA_MOI = 'Về nhà mới',
  XUAT_HANH = 'Xuất hành',
  KHAI_TRUONG = 'Khai trương',
  KY_HOP_DONG = 'Ký hợp đồng',
  MUA_NHA = 'Mua nhà',
  CHO_VAY_MUON = 'Cho vay mượn',
  MUA_XE = 'Mua xe',
}

export const toolXemNgayTot = tool(
  async ({ date }) => {
    try {
      logger.log(`Calling xem_ngay_tot_am_lich_vn with date: ${date}`);
      const result = await callPlatformApi({
        request_url: `https://api.astroreka.com/platform/v1/xem-ngay-tot/get-day-report?date=${date}`,
        request_method: 'GET',
      });
      logger.log(`Kết quả xem ngày tốt - Size: ${JSON.stringify(result).length} chars, Keys: ${Object.keys(result as Record<string, any>).length}`);
      return result;
    } catch (error) {
      logger.error(`Error calling xem_ngay_tot_am_lich_vn: ${error.message}`, error.stack);
      throw error;
    }
  },
  {
    name: 'xem_ngay_tot_am_lich_vn',
    description:
      'XEM CHI TIẾT THÔNG TIN 1 NGÀY (CHUNG). Tra cứu thông tin chi tiết của một ngày cụ thể (giờ hoàng đạo, sao tốt/xấu, trực, hắc đạo...) khi người dùng KHÔNG cung cấp năm sinh và KHÔNG hỏi cho một công việc cụ thể. Chỉ dùng cho câu hỏi về 1 ngày duy nhất.',
    schema: z.object({
      date: z
        .string()
        .describe('Ngày dương lịch cần xem (định dạng yyyy-MM-dd)'),
    }),
  },
);

export const toolDanhSachNgayTot = tool(
  async ({ start_date, end_date }) => {
    try {
      logger.log(`Calling danh_sach_ngay_tot_am_lich_vn from ${start_date} to ${end_date}`);
      const result = await callPlatformApi({
        request_url: `https://api.astroreka.com/platform/v1/xem-ngay-tot/get-report?start_date=${start_date}&end_date=${end_date}`,
        request_method: 'GET',
      });
      logger.log(`Danh sách ngày tốt - Size: ${JSON.stringify(result).length} chars, Keys: ${Object.keys(result as Record<string, any>).length}`);
      return result;
    } catch (error) {
      logger.error(`Error calling danh_sach_ngay_tot_am_lich_vn: ${error.message}`, error.stack);
      throw error;
    }
  },
  {
    name: 'danh_sach_ngay_tot_am_lich_vn',
    description:
      'TRA CỨU DANH SÁCH NGÀY TỐT (CHUNG). Tìm các ngày tốt/đẹp trong một khoảng thời gian (tuần, tháng, khoảng ngày). Sử dụng cho các câu hỏi chung như "Tuần sau có ngày nào tốt?", "Tháng này ngày nào đẹp?", "Tìm ngày tốt trong tháng 5"... khi người dùng KHÔNG cung cấp năm sinh và KHÔNG hỏi cho một công việc cụ thể.',
    schema: z.object({
      start_date: z
        .string()
        .describe('Ngày bắt đầu (dương lịch) định dạng yyyy-MM-dd'),
      end_date: z
        .string()
        .describe('Ngày kết thúc (dương lịch) định dạng yyyy-MM-dd'),
    }),
  },
);

export const toolXemNgayTotTheoTuoiTheoViec = tool(
  async ({ lunar_birth_year, date, activity = Viec.KHOI_CONG }) => {
    try {
      logger.log(`Calling xem_ngay_tot_viec_tot_am_lich_vn with year: ${lunar_birth_year}, date: ${date}, activity: ${activity}`);
      const result = await callPlatformApi({
        request_url: `https://api.astroreka.com/platform/v1/xem-ngay-tot/get-day-report-by-activity?lunar_birth_year=${lunar_birth_year}&activity=${activity}&date=${date}`,
        request_method: 'GET',
      });
      logger.log(`Kết quả xem ngày tốt theo tuổi và việc - Size: ${JSON.stringify(result).length} chars, Keys: ${Object.keys(result as Record<string, any>).length}`);
      return result;
    } catch (error) {
      logger.error(`Error calling xem_ngay_tot_viec_tot_am_lich_vn: ${error.message}`, error.stack);
      throw error;
    }
  },
  {
    name: 'xem_ngay_tot_viec_tot_am_lich_vn',
    description:
      'XEM NGÀY TỐT CÁ NHÂN/THEO VIỆC (1 NGÀY). Kiểm tra xem một ngày cụ thể có hợp để làm một việc nhất định (cưới hỏi, khởi công, mua xe...) và có hợp với TUỔI/NĂM SINH của người dùng hay không. SỬ DỤNG KHI: Có thông tin công việc cụ thể được nhắc đến.',
    schema: z.object({
      lunar_birth_year: z
        .number()
        .describe('Năm sinh âm lịch của người dùng (ví dụ: 1995)'),
      date: z
        .string()
        .describe('Ngày dương lịch cần xem (định dạng yyyy-MM-dd)'),
      activity: z
        .enum(Object.values(Viec) as [string, ...string[]])
        .describe('Công việc cần xem (ví dụ: Khởi công, Mua xe...)'),
    }),
  },
);

export const toolDanhSachNgayTotTheoTuoiTheoViec = tool(
  async ({
    lunar_birth_year,
    start_date,
    end_date,
    activity = Viec.KHOI_CONG,
  }) => {
    try {
      logger.log(`Calling danh_sach_ngay_tot_viec_tot_am_lich_vn with year: ${lunar_birth_year}, from ${start_date} to ${end_date}, activity: ${activity}`);
      const result = await callPlatformApi({
        request_url: `https://api.astroreka.com/platform/v1/xem-ngay-tot/get-report-by-activity?lunar_birth_year=${lunar_birth_year}&activity=${activity}&start_date=${start_date}&end_date=${end_date}`,
        request_method: 'GET',
      });
      logger.log(`Danh sách ngày tốt theo tuổi và việc - Size: ${JSON.stringify(result).length} chars, Keys: ${Object.keys(result as Record<string, any>).length}`);
      return result;
    } catch (error) {
      logger.error(`Error calling danh_sach_ngay_tot_viec_tot_am_lich_vn: ${error.message}`, error.stack);
      throw error;
    }
  },
  {
    name: 'danh_sach_ngay_tot_viec_tot_am_lich_vn',
    description:
      'TÌM DANH SÁCH NGÀY TỐT CÁ NHÂN/THEO VIỆC (KHOẢNG THỜI GIAN). Tìm các ngày tốt nhất để thực hiện một công việc cụ thể trong một khoảng thời gian, có tính đến yếu tố TUỔI/NĂM SINH của người dùng. SỬ DỤNG KHI: Người dùng muốn tìm ngày đẹp để "làm việc X".',
    schema: z.object({
      lunar_birth_year: z
        .number()
        .describe('Năm sinh âm lịch của người dùng (ví dụ: 1990)'),
      start_date: z
        .string()
        .describe('Ngày bắt đầu (dương lịch) định dạng yyyy-MM-dd'),
      end_date: z
        .string()
        .describe('Ngày kết thúc (dương lịch) định dạng yyyy-MM-dd'),
      activity: z
        .enum(Object.values(Viec) as [string, ...string[]])
        .describe('Công việc cần xem (mặc định là Khởi công nếu không rõ)'),
    }),
  },
);
