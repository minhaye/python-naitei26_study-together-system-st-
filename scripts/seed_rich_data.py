import asyncio
import os
import sys
import uuid
import random

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    for _stream in (sys.stdout, sys.stderr):
        if hasattr(_stream, "reconfigure"):
            _stream.reconfigure(encoding="utf-8", errors="replace")

from datetime import datetime, timedelta, date
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")

async def seed():
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set in .env")
        return

    print("Connecting to database...", flush=True)
    engine = create_async_engine(
        DATABASE_URL,
        connect_args={"prepare_threshold": None},
        pool_pre_ping=True
    )
    
    async with engine.begin() as conn:
        print("--- STARTING SEEDING PROCESS ---", flush=True)
        
        # 1. Fetch existing profiles (currently 57 profiles)
        res = await conn.execute(text("SELECT id, username FROM profiles;"))
        existing_profiles = res.fetchall()
        profile_ids = [r[0] for r in existing_profiles]
        print(f"Total existing profiles available: {len(profile_ids)}")

        # 2. Fetch existing groups
        res = await conn.execute(text("SELECT id, owner_id FROM groups;"))
        existing_groups = res.fetchall()
        group_ids = [r[0] for r in existing_groups]

        # Target: at least 56 groups
        needed_groups = max(0, 56 - len(group_ids))
        if needed_groups > 0:
            print(f"Creating {needed_groups} new groups...")
            group_topics = [
                ("Cùng Học Python & Data Science 2026", "Nhóm học lập trình Python, Pandas, Numpy và Machine Learning dành cho người mới bắt đầu."),
                ("Luyện Thi IELTS 7.5+ Writing & Speaking", "Tập trung sửa bài Writing Task 2 và mock test Speaking 1v1 hàng tuần."),
                ("Ôn Thi Đại Học Môn Toán - Đề Chuyên", "Giải các bài toán vận dụng cao 9+ kỳ thi THPT Quốc Gia."),
                ("CLB Thuật Toán & LeetCode Hard", "Cùng làm LeetCode Daily, ôn tập Cấu trúc dữ liệu & Giải thuật."),
                ("Nhóm Học Tiếng Nhật N2 - N1 JLPT", "Chia sẻ từ vựng, ngữ pháp Kanji và choukai hàng ngày."),
                ("Học Sinh THPT - Chinh Phục Kỳ Thi ĐGNL", "Luyện đề Đánh giá năng lực ĐHQG Hà Nội và TP.HCM."),
                ("Dev Fullstack Web (React + FastAPI)", "Xây dựng project thực tế fullstack từ thiết kế API đến UI."),
                ("Cùng Nhau Dậy Sớm Học Bài 5:00 AM", "Kỷ luật bản thân, điểm danh Pomodoro sáng sớm 5h-7h."),
                ("Học Machine Learning & Deep Learning", "Nghiên cứu Paper, Pytorch và ứng dụng AI thực tế."),
                ("Cơ Sở Dữ Liệu & SQL Mastery", "Tối ưu câu lệnh PostgreSQL, Indexing, Transaction và RLS."),
                ("Nhóm Ôn Thi THPT Quốc Gia Môn Vật Lý", "Chinh phục 40 câu trắc nghiệm Vật Lý THPTQG."),
                ("Hóa Học Hữu Cơ & Bài Tập Nâng Cao", "Thảo luận về cơ chế phản ứng hữu cơ và bài tập chuỗi phản ứng."),
                ("Luyện Nói Tiếng Anh Hàng Ngày", "Tự tin giao tiếp Tiếng Anh qua Voice Channel."),
                ("Tiếng Trung HSK 5 - HSK 6", "Luyện nghe nói đọc viết HSK nâng cao."),
                ("Thiết Kế UI/UX & Figma Design", "Chia sẻ Design System, Auto-layout và Wireframing."),
                ("Kiến Thức Triết Học Mác - Lênin", "Ôn tập thi môn Đại cương đại học."),
                ("Luyện Thi TOEIC 900+ Listening & Reading", "Bí quyết đạt điểm tối đa Part 5, 6, 7."),
                ("Nhóm Nghiên Cứu Y Dược & Lâm Sàng", "Trao đổi tài liệu y khoa, dược lý và thuật ngữ y học."),
                ("Kinh Tế Vĩ Mô & Tài Chính Doanh Nghiệp", "Phân tích báo cáo tài chính và chỉ số kinh tế."),
                ("Cấu Trúc Dữ Liệu & Giải Thuật C++", "Luyện viết code C++ tối ưu bộ nhớ và thời gian chạy."),
                ("Chinh Phục Chứng Chỉ AWS Cloud Developer", "Ôn luyện đề thi AWS Certified Developer Associate."),
                ("Nhóm Học Tiếng Hàn TOPIK II", "Ôn ngữ pháp và kỹ năng 쓰기 (Writing) TOPIK."),
                ("Tự Học Marketing Digital & SEO", "Chia sẻ kiến thức SEO Onpage, Offpage và Content Marketing."),
                ("Lập Trình Di Động Flutter Cross-Platform", "Xây dựng ứng dụng Android & iOS bằng Flutter."),
                ("An Toàn Thông Tin & Ethical Hacking", "Tìm hiểu lỗ hổng Web, OWASP Top 10 và CTF Challenges."),
                ("Quản Lý Dự Án Agile & Scrum", "Áp dụng Jira, Trello và quy trình Scrum trong làm việc nhóm."),
                ("Nghiên Cứu Sinh Học & Biologie", "Giải thích các hiện tượng sinh học và di truyền học."),
                ("Luyện Thi Chuyên Tin THPT", "Giải đề thi HSG Quốc Gia và Olympic Tin Học."),
                ("Kỹ Năng Viết Email & Resume Chuyên Nghiệp", "Sửa CV, cover letter và email xin việc."),
                ("Nhóm Học Tiếng Pháp DELF B1-B2", "Luyện ngữ pháp và phản xạ tiếng Pháp."),
                ("Kinh Nghiệm Săn Học Bổng Du Học", "Chia sẻ bí quyết viết bài luận Personal Statement."),
                ("Lập Trình Game với Unity & C#", "Làm game 2D/3D từ cơ bản đến hoàn thiện."),
                ("Kế Toán Tài Chính & Kiểm Toán", "Thảo luận chuẩn mực kế toán VAS & IFRS."),
                ("Tâm Lý Học Vui & Ứng Dụng", "Đọc sách tâm lý, quản lý cảm xúc và áp lực học tập."),
                ("Đọc Sách & Phát Triển Bản Thân", "Mỗi tuần 1 cuốn sách hay về tư duy và thành công."),
                ("Luyện Thi Đánh Giá Tư Duy Bách Khoa", "Giải đề thi TSA ĐH Bách Khoa Hà Nội."),
                ("Quản Lý Tài Chính Cá Nhân Cho Sinh Viên", "Bí quyết tiết kiệm, đầu tư nhỏ và quản lý chi tiêu."),
                ("Nghiên Cứu Lịch Sử & Địa Lý Việt Nam", "Tìm hiểu các mốc lịch sử hào hùng và địa lý vùng miền."),
                ("Lập Trình Web Backend với Go (Golang)", "Học Go, Microservices và gRPC."),
                ("Học Tiếng Đức A2 - B1 Goethe", "Luyện nghe nói phản xạ tiếng Đức."),
                ("Nghệ Thuật Thuyết Trình & Debate", "Rèn luyện tư duy phản biện và kỹ năng nói trước đám đông."),
                ("Luyện Thi Công Viên Cán Bộ Nhà Nước", "Thảo luận kiến thức quản lý nhà nước và pháp luật."),
                ("Xây Dựng Thương Hiệu Cá Nhân trên LinkedIn", "Tối ưu Profile LinkedIn thu hút nhà tuyển dụng."),
                ("Tự Học Piano & Cảm Âm Âm Nhạc", "Chia sẻ sheet nhạc và lý thuyết âm nhạc cơ bản."),
                ("Nhóm Tự Học Đêm Khuya (Night Owls)", "Học tập im lặng 23h-02h sáng mỗi ngày.")
            ]
            
            for name, desc in group_topics[:needed_groups]:
                g_id = uuid.uuid4()
                owner_id = random.choice(profile_ids)
                code = uuid.uuid4().hex[:12]
                await conn.execute(text("""
                    INSERT INTO groups (id, name, description, owner_id, invite_code, is_public)
                    VALUES (:id, :name, :desc, :owner_id, :code, true);
                """), {"id": g_id, "name": name, "desc": desc, "owner_id": owner_id, "code": code})
                group_ids.append(g_id)

        print(f"Total groups available: {len(group_ids)}")

        # 3. Add Group Members & Streaks
        print("Ensuring Group Members & Streaks...")
        for g_id in group_ids:
            # Check existing streak
            res = await conn.execute(text("SELECT group_id FROM group_streaks WHERE group_id = :g_id;"), {"g_id": g_id})
            if not res.scalar():
                c_streak = random.randint(1, 30)
                h_streak = c_streak + random.randint(0, 20)
                await conn.execute(text("""
                    INSERT INTO group_streaks (group_id, current_streak, highest_streak, activity_date, today_messages_count, today_study_minutes)
                    VALUES (:g_id, :cs, :hs, CURRENT_DATE, :mc, :sm);
                """), {"g_id": g_id, "cs": c_streak, "hs": h_streak, "mc": random.randint(5, 50), "sm": random.randint(30, 240)})
            
            # Add 3-6 extra members per group
            selected_users = random.sample(profile_ids, min(len(profile_ids), random.randint(4, 8)))
            for u_id in selected_users:
                role = random.choice(["moderator", "member", "member", "member"])
                await conn.execute(text("""
                    INSERT INTO group_members (group_id, user_id, role, status)
                    VALUES (:g_id, :u_id, CAST(:role AS group_member_role), CAST('active' AS member_status))
                    ON CONFLICT (group_id, user_id) DO NOTHING;
                """), {"g_id": g_id, "u_id": u_id, "role": role})

        # 4. Fetch Channels & Create more if needed (Target: 60+)
        res = await conn.execute(text("SELECT id, group_id FROM channels;"))
        existing_channels = res.fetchall()
        channel_ids = [r[0] for r in existing_channels]

        needed_channels = max(0, 60 - len(channel_ids))
        if needed_channels > 0:
            print(f"Creating {needed_channels} new channels...")
            c_names = ["thao-luan-chung", "tai-lieu-hoc-tap", "giai-dap-bai-tap", "code-review", "thong-bao-nhom", "goc-tam-su", "tro-truyen-voice"]
            for i in range(needed_channels):
                g_id = random.choice(group_ids)
                name = f"{random.choice(c_names)}-{uuid.uuid4().hex[:4]}"
                c_id = uuid.uuid4()
                res_m = await conn.execute(text("SELECT user_id FROM group_members WHERE group_id = :g_id LIMIT 1;"), {"g_id": g_id})
                creator_id = res_m.scalar() or random.choice(profile_ids)
                await conn.execute(text("""
                    INSERT INTO channels (id, group_id, name, type, created_by)
                    VALUES (:id, :g_id, :name, CAST('text' AS channel_type), :creator_id)
                    ON CONFLICT (group_id, name) DO NOTHING;
                """), {"id": c_id, "g_id": g_id, "name": name, "creator_id": creator_id})
                channel_ids.append(c_id)

        # Ensure Channel Members
        print("Ensuring channel memberships...")
        for c_id in channel_ids:
            res_g = await conn.execute(text("SELECT group_id FROM channels WHERE id = :c_id;"), {"c_id": c_id})
            g_id = res_g.scalar()
            if g_id:
                res_m = await conn.execute(text("SELECT user_id FROM group_members WHERE group_id = :g_id;"), {"g_id": g_id})
                members = [r[0] for r in res_m.fetchall()]
                for u_id in members:
                    await conn.execute(text("""
                        INSERT INTO channel_members (channel_id, user_id)
                        VALUES (:c_id, :u_id)
                        ON CONFLICT (channel_id, user_id) DO NOTHING;
                    """), {"c_id": c_id, "u_id": u_id})

        # 5. Study Rooms & Study Room Members & Moderation Actions (Target: 60+)
        res = await conn.execute(text("SELECT id, group_id, host_id FROM study_rooms;"))
        existing_rooms = res.fetchall()
        room_ids = [r[0] for r in existing_rooms]

        needed_rooms = max(0, 60 - len(room_ids))
        if needed_rooms > 0:
            print(f"Creating {needed_rooms} new study rooms...")
            r_titles = [
                "Phòng Học Im Lặng (Silence Pomodoro)",
                "Live Stream Giải Đề Thi Thử",
                "Group Discussion - Mock Interview",
                "Cùng Code - Live Pair Programming",
                "Phòng Tự Học Ban Đêm (Night Owls)",
                "Luyện Speaking IELTS 1v1",
                "Ôn Thi Cuối Kỳ - Chữa Bài Tập",
                "Góc Ôn Thi Cùng Nhau"
            ]
            for i in range(needed_rooms):
                g_id = random.choice(group_ids)
                res_m = await conn.execute(text("SELECT user_id FROM group_members WHERE group_id = :g_id LIMIT 1;"), {"g_id": g_id})
                host_id = res_m.scalar() or random.choice(profile_ids)
                r_id = uuid.uuid4()
                title = f"{random.choice(r_titles)} #{random.randint(10, 99)}"
                status = random.choice(["waiting", "active", "ended"])
                await conn.execute(text("""
                    INSERT INTO study_rooms (id, group_id, name, description, host_id, status, max_participants)
                    VALUES (:id, :g_id, :name, 'Phòng học nhóm tự học chung kỷ luật.', :host_id, CAST(:status AS study_room_status), 50);
                """), {"id": r_id, "g_id": g_id, "name": title, "host_id": host_id, "status": status})
                room_ids.append(r_id)

        # Add study room members
        for r_id in room_ids:
            res_r = await conn.execute(text("SELECT group_id, host_id FROM study_rooms WHERE id = :r_id;"), {"r_id": r_id})
            r_info = res_r.fetchone()
            if r_info:
                g_id, host_id = r_info[0], r_info[1]
                res_m = await conn.execute(text("SELECT user_id FROM group_members WHERE group_id = :g_id;"), {"g_id": g_id})
                g_members = [r[0] for r in res_m.fetchall()]
                for u_id in g_members[:5]:
                    role = "host" if u_id == host_id else "participant"
                    await conn.execute(text("""
                        INSERT INTO study_room_members (room_id, user_id, role)
                        VALUES (:r_id, :u_id, CAST(:role AS study_room_member_role))
                        ON CONFLICT (room_id, user_id) DO NOTHING;
                    """), {"r_id": r_id, "u_id": u_id, "role": role})

        # Room moderation actions (Target: 56+)
        res = await conn.execute(text("SELECT COUNT(*) FROM room_moderation_actions;"))
        curr_rma = res.scalar()
        needed_rma = max(0, 56 - curr_rma)
        if needed_rma > 0:
            print(f"Creating {needed_rma} room moderation actions...")
            mod_reasons = [
                "Phát âm thanh gây ồn trong phòng yên tĩnh.",
                "Yêu cầu giơ tay trước khi phát biểu.",
                "Spam micro gây rè tiếng.",
                "Vi phạm nội quy tự học.",
                "Quá thời gian trình bày bài tập."
            ]
            actions = ["mute", "unmute", "kick", "raise_hand", "lower_hand"]
            for i in range(needed_rma):
                r_id = random.choice(room_ids)
                res_m = await conn.execute(text("SELECT user_id FROM study_room_members WHERE room_id = :r_id;"), {"r_id": r_id})
                rm_users = [r[0] for r in res_m.fetchall()]
                if len(rm_users) >= 2:
                    mod_id = rm_users[0]
                    target_id = rm_users[1]
                else:
                    mod_id = random.choice(profile_ids)
                    target_id = random.choice(profile_ids)
                
                await conn.execute(text("""
                    INSERT INTO room_moderation_actions (room_id, moderator_id, target_user_id, action, reason)
                    VALUES (:r_id, :m_id, :t_id, CAST(:act AS moderation_action), :reason);
                """), {"r_id": r_id, "m_id": mod_id, "t_id": target_id, "act": random.choice(actions), "reason": random.choice(mod_reasons)})

        # 6. Conversations & Conversation Members & Messages (Target: 80+ conversations, 450+ messages)
        print("Ensuring channel/room/direct conversations...")
        for c_id in channel_ids:
            res_c = await conn.execute(text("SELECT id FROM conversations WHERE channel_id = :c_id;"), {"c_id": c_id})
            conv_id = res_c.scalar()
            if not conv_id:
                conv_id = uuid.uuid4()
                res_m = await conn.execute(text("SELECT created_by FROM channels WHERE id = :c_id;"), {"c_id": c_id})
                creator = res_m.scalar() or random.choice(profile_ids)
                await conn.execute(text("""
                    INSERT INTO conversations (id, type, channel_id, created_by)
                    VALUES (:id, CAST('channel' AS conversation_type), :c_id, :creator);
                """), {"id": conv_id, "c_id": c_id, "creator": creator})
            
            res_cm = await conn.execute(text("SELECT user_id FROM channel_members WHERE channel_id = :c_id;"), {"c_id": c_id})
            for row in res_cm.fetchall():
                await conn.execute(text("""
                    INSERT INTO conversation_members (conversation_id, user_id)
                    VALUES (:conv_id, :u_id)
                    ON CONFLICT (conversation_id, user_id) DO NOTHING;
                """), {"conv_id": conv_id, "u_id": row[0]})

        res = await conn.execute(text("SELECT id FROM conversations;"))
        conv_ids = [r[0] for r in res.fetchall()]
        needed_convs = max(0, 80 - len(conv_ids))
        for i in range(needed_convs):
            pair = random.sample(profile_ids, 2)
            u1, u2 = sorted([str(pair[0]), str(pair[1])])
            c_id = uuid.uuid4()
            await conn.execute(text("""
                INSERT INTO conversations (id, type, created_by, direct_user_min_id, direct_user_max_id)
                VALUES (:id, CAST('direct' AS conversation_type), :u1, :u1, :u2);
            """), {"id": c_id, "u1": u1, "u2": u2})
            conv_ids.append(c_id)
            await conn.execute(text("INSERT INTO conversation_members (conversation_id, user_id) VALUES (:c_id, :u1) ON CONFLICT DO NOTHING;", {"c_id": c_id, "u1": u1}))
            await conn.execute(text("INSERT INTO conversation_members (conversation_id, user_id) VALUES (:c_id, :u2) ON CONFLICT DO NOTHING;", {"c_id": c_id, "u2": u2}))

        # Messages (Target: 450+)
        res = await conn.execute(text("SELECT COUNT(*) FROM messages;"))
        curr_msg_count = res.scalar()
        needed_messages = max(0, 450 - curr_msg_count)
        if needed_messages > 0:
            print(f"Creating {needed_messages} new messages...")
            msg_templates = [
                "Chào mọi người, hôm nay chúng ta học đến phần nào rồi ạ?",
                "Có ai làm được câu 45 đề thi thử hôm qua chưa, cho mình hỏi với!",
                "Mình vừa upload file tài liệu mới vào folder nhóm nhé.",
                "Mọi người nhớ tối nay 20h có buổi họp nhóm qua Study Room nha.",
                "Cảm ơn bạn nhé, giải thích rất chi tiết và dễ hiểu!",
                "Cho mình xin link slide bài giảng hôm nay với ạ.",
                "Mọi người cùng bật Pomodoro học bài nào, 25 phút bắt đầu!",
                "Đoạn code này bị bug NullPointer, có ai fix giúp mình được không?",
                "Hôm nay mình vừa hoàn thành 50 câu trắc nghiệm Toán, vui quá!",
                "Chúc mọi người một tuần mới học tập thật hiệu quả và đạt nhiều streak!"
            ]
            for i in range(needed_messages):
                c_id = random.choice(conv_ids)
                res_cm = await conn.execute(text("SELECT user_id FROM conversation_members WHERE conversation_id = :c_id;"), {"c_id": c_id})
                c_users = [r[0] for r in res_cm.fetchall()]
                sender_id = random.choice(c_users) if c_users else random.choice(profile_ids)
                content = random.choice(msg_templates)
                msg_id = uuid.uuid4()
                await conn.execute(text("""
                    INSERT INTO messages (id, conversation_id, sender_id, content)
                    VALUES (:id, :c_id, :s_id, :content);
                """), {"id": msg_id, "c_id": c_id, "s_id": sender_id, "content": content})

        # Message Reactions (Target: 60+)
        res = await conn.execute(text("SELECT COUNT(*) FROM message_reactions;"))
        curr_mr = res.scalar()
        needed_mr = max(0, 60 - curr_mr)
        if needed_mr > 0:
            print(f"Creating {needed_mr} message reactions...")
            res_m = await conn.execute(text("SELECT id, conversation_id FROM messages LIMIT 100;"))
            msgs = res_m.fetchall()
            emojis = ["👍", "❤️", "😆", "😮", "😢", "😡"]
            for i in range(needed_mr):
                if msgs:
                    m_row = random.choice(msgs)
                    m_id, conv_id = m_row[0], m_row[1]
                    u_id = random.choice(profile_ids)
                    await conn.execute(text("""
                        INSERT INTO message_reactions (message_id, conversation_id, user_id, emoji)
                        VALUES (:m_id, :c_id, :u_id, :emoji)
                        ON CONFLICT (message_id, user_id) DO NOTHING;
                    """), {"m_id": m_id, "c_id": conv_id, "u_id": u_id, "emoji": random.choice(emojis)})

        # 7. Invitations (Target: 56+)
        res = await conn.execute(text("SELECT COUNT(*) FROM invitations;"))
        curr_inv = res.scalar()
        needed_inv = max(0, 56 - curr_inv)
        if needed_inv > 0:
            print(f"Creating {needed_inv} invitations...")
            inv_methods = ["email", "code"]
            inv_statuses = ["pending", "accepted", "declined", "expired"]
            for i in range(needed_inv):
                g_id = random.choice(group_ids)
                creator_id = random.choice(profile_ids)
                sec_hash = uuid.uuid4().hex
                method = random.choice(inv_methods)
                status = random.choice(inv_statuses)
                exp = datetime.now() + timedelta(days=random.randint(1, 14))
                await conn.execute(text("""
                    INSERT INTO invitations (group_id, method, status, created_by, secret_hash, expires_at, recipient_email)
                    VALUES (:g_id, CAST(:method AS invitation_method), CAST(:status AS invitation_status), :creator, :shash, :exp, :email);
                """), {
                    "g_id": g_id,
                    "method": method,
                    "status": status,
                    "creator": creator_id,
                    "shash": sec_hash,
                    "exp": exp,
                    "email": f"invitee_{i}@example.com" if method == "email" else None
                })

        # 8. Resource Folders & Resources (Target: 56+ folders, 56+ resources)
        res = await conn.execute(text("SELECT id FROM resource_folders;"))
        existing_rf = res.fetchall()
        rf_ids = [r[0] for r in existing_rf]
        needed_rf = max(0, 56 - len(rf_ids))
        if needed_rf > 0:
            print(f"Creating {needed_rf} resource folders...")
            rf_names = [
                "Slide Giảng Bài & Giáo Trình",
                "Đề Thi Thử & Đáp Án Chi Tiết",
                "Tài Liệu Ôn Tập Cuối Kỳ",
                "Source Code & Project Mẫu",
                "Ebook Tiếng Anh Specialized",
                "Cheatsheet & Tóm Tắt Lý Thuyết"
            ]
            for i in range(needed_rf):
                g_id = random.choice(group_ids)
                creator_id = random.choice(profile_ids)
                rf_id = uuid.uuid4()
                await conn.execute(text("""
                    INSERT INTO resource_folders (id, group_id, name, created_by)
                    VALUES (:id, :g_id, :name, :creator);
                """), {"id": rf_id, "g_id": g_id, "name": f"{random.choice(rf_names)} #{i+1}", "creator": creator_id})
                rf_ids.append(rf_id)

        res = await conn.execute(text("SELECT COUNT(*) FROM resources;"))
        curr_res = res.scalar()
        needed_resources = max(0, 56 - curr_res)
        if needed_resources > 0:
            print(f"Creating {needed_resources} resources...")
            res_templates = [
                ("De_thi_thu_THPT_2026_Mon_Toan.pdf", "application/pdf", 2450000),
                ("FastAPI_Production_Best_Practices.pdf", "application/pdf", 5120000),
                ("IELTS_Writing_Task_2_Band_8_Templates.pdf", "application/pdf", 1800000),
                ("Cau_truc_du_lieu_va_Giai_thuat_Full.pdf", "application/pdf", 8900000),
                ("Bang_tuan_hoan_hoa_hoc_HD.png", "image/png", 650000),
                ("Machine_Learning_Yearning_Andrew_Ng.pdf", "application/pdf", 4300000),
                ("N2_Kanji_Master_1000_Tu.pdf", "application/pdf", 3200000)
            ]
            for i in range(needed_resources):
                g_id = random.choice(group_ids)
                uploader_id = random.choice(profile_ids)
                folder_id = random.choice(rf_ids) if rf_ids else None
                name, ftype, fsize = random.choice(res_templates)
                file_path = f"groups/{g_id}/{uuid.uuid4().hex}_{name}"
                await conn.execute(text("""
                    INSERT INTO resources (group_id, uploader_id, folder_id, name, file_path, file_type, file_size)
                    VALUES (:g_id, :u_id, :f_id, :name, :fpath, :ftype, :fsize);
                """), {
                    "g_id": g_id,
                    "u_id": uploader_id,
                    "f_id": folder_id,
                    "name": f"{i+1}_{name}",
                    "fpath": file_path,
                    "ftype": ftype,
                    "fsize": fsize
                })

        # 9. Group Notes (Target: 56+)
        res = await conn.execute(text("SELECT COUNT(*) FROM group_notes;"))
        curr_gn = res.scalar()
        needed_gn = max(0, 56 - curr_gn)
        if needed_gn > 0:
            print(f"Creating {needed_gn} group notes...")
            note_templates = [
                ("Tóm Tắt Kiến Thức Trọng Tâm Môn Toán", "Hôm nay nhóm đã tổng hợp lại 10 dạng toán tích phân thường gặp trong đề thi THPTQG."),
                ("Danh Sách Từ Vựng IELTS Topic Environment", "Gồm 30 collocation chủ đề môi trường: carbon footprint, renewable energy, deforestation..."),
                ("Ghi Chú Cuộc Họp Nhóm Tuần 3", "Phân công nhiệm vụ: Hải làm Backend API, Tú làm UI Component, Ngọc làm database migration."),
                ("Quy Trình Triển Khai App Lên Render", "Các bước setup Docker container, config environment variables và auto deploy trên Render."),
                ("Tổ Ngữ Pháp Tiếng Nhật N2 Cần Lưu Ý", "Tổng hợp các mẫu cấu trúc ~ ni chigainai, ~ koto ni natte iru, ~ tsuide ni...")
            ]
            for i in range(needed_gn):
                g_id = random.choice(group_ids)
                author_id = random.choice(profile_ids)
                title, content = random.choice(note_templates)
                await conn.execute(text("""
                    INSERT INTO group_notes (group_id, author_id, title, content)
                    VALUES (:g_id, :a_id, :title, :content);
                """), {"g_id": g_id, "a_id": author_id, "title": f"{title} #{i+1}", "content": content})

        # 10. Tasks (Target: 56+)
        res = await conn.execute(text("SELECT COUNT(*) FROM tasks;"))
        curr_tasks = res.scalar()
        needed_tasks = max(0, 56 - curr_tasks)
        if needed_tasks > 0:
            print(f"Creating {needed_tasks} tasks...")
            task_titles = [
                "Hoàn thành 50 câu trắc nghiệm Toán",
                "Làm bài tập Asyncio Python",
                "Viết 1 bài IELTS Writing Task 2",
                "Review PR cho thành viên trong nhóm",
                "Đọc chương 4 sách Clean Code",
                "Học 30 từ vựng Kanji mới",
                "Luyện nghe 3 bài TOEIC Part 4",
                "Thiết kế DB Schema cho module Moderation"
            ]
            for i in range(needed_tasks):
                u_id = random.choice(profile_ids)
                title = random.choice(task_titles)
                due = date.today() + timedelta(days=random.randint(1, 20))
                prio = random.randint(1, 3)
                is_comp = random.choice([True, False])
                comp_at = datetime.now() if is_comp else None
                await conn.execute(text("""
                    INSERT INTO tasks (user_id, title, due_date, priority, completed_at)
                    VALUES (:u_id, :title, :due, :prio, :comp_at);
                """), {"u_id": u_id, "title": f"{title} #{i+1}", "due": due, "prio": prio, "comp_at": comp_at})

        # 11. Roadmaps & Roadmap Phases (Target: 56+ roadmaps, 110+ phases)
        res = await conn.execute(text("SELECT id FROM roadmaps;"))
        existing_rm = res.fetchall()
        rm_ids = [r[0] for r in existing_rm]
        needed_rm = max(0, 56 - len(rm_ids))
        if needed_rm > 0:
            print(f"Creating {needed_rm} roadmaps...")
            rm_templates = [
                ("Lộ Trình Học Python từ Zero đến Hero 2026", "Chinh phục Python cơ bản, OOP, FastAPI và Deployment."),
                ("Lộ Trình IELTS 8.0 Trong 6 Tháng", "Tập trung nâng điểm 2 kỹ năng Output: Writing và Speaking."),
                ("Chinh Phục Kỳ Thi Đánh Giá Năng Lực 2026", "Học toàn diện Tư duy định lượng, định tính và Khoa học."),
                ("Lộ Trình Trở Thành Fullstack Developer", "Master HTML/CSS/JS, React, Python FastAPI và PostgreSQL."),
                ("Luyện Thi JLPT N2 Chuẩn Nhật", "Hoàn thành 1000 Kanji, 200 mẫu ngữ pháp và luyện choukai hàng ngày.")
            ]
            for i in range(needed_rm):
                u_id = random.choice(profile_ids)
                title, goal = random.choice(rm_templates)
                rm_id = uuid.uuid4()
                due = date.today() + timedelta(days=random.randint(30, 180))
                await conn.execute(text("""
                    INSERT INTO roadmaps (id, user_id, title, goal, due_date)
                    VALUES (:id, :u_id, :title, :goal, :due);
                """), {"id": rm_id, "u_id": u_id, "title": f"{title} #{i+1}", "goal": goal, "due": due})
                rm_ids.append(rm_id)

        # Ensure Roadmap Phases (Target: 110+)
        res = await conn.execute(text("SELECT COUNT(*) FROM roadmap_phases;"))
        curr_rp = res.scalar()
        needed_rp = max(0, 110 - curr_rp)
        if needed_rp > 0:
            print(f"Creating {needed_rp} roadmap phases...")
            phase_names = [
                "Giai đoạn 1: Nền tảng lý thuyết cơ bản",
                "Giai đoạn 2: Thực hành làm bài tập mẫu",
                "Giai đoạn 3: Thực hiện đồ án / Luyện đề chuyên sâu",
                "Giai đoạn 4: Đánh giá kết quả & Thi thử"
            ]
            for rm_id in rm_ids:
                for pos in range(1, 3):
                    await conn.execute(text("""
                        INSERT INTO roadmap_phases (roadmap_id, name, position, progress)
                        VALUES (:rm_id, :name, :pos, :prog)
                        ON CONFLICT (roadmap_id, position) DO NOTHING;
                    """), {"rm_id": rm_id, "name": phase_names[pos-1], "pos": pos, "prog": random.choice([0, 25, 50, 75, 100])})

        # 12. Forum Categories (Target: 52+)
        res = await conn.execute(text("SELECT id, name FROM forum_categories;"))
        existing_cats = res.fetchall()
        cat_ids = [r[0] for r in existing_cats]
        cat_names = set([r[1] for r in existing_cats])
        
        needed_cats = max(0, 52 - len(cat_ids))
        if needed_cats > 0:
            print(f"Creating {needed_cats} forum categories...")
            new_cat_list = [
                "Lập Trình Di Động (Flutter/React Native)", "Trí Tuệ Nhân Tạo & Data Science", "An Toàn Thông Tin & Cyber Security",
                "Thiết Kế Đồ Họa & UI/UX", "Kỹ Năng Mềm & Phát Triển Bản Thân", "Góc Tuyển Dụng & Thực Tập Sinh",
                "Săn Học Bổng Du Học 2026", "Tiếng Trung (HSK)", "Tiếng Hàn (TOPIK)", "Vật Lý Đại Xung & Cơ Học",
                "Hóa Học & Đời Sống", "Sinh Học & Y Học Thường Thức", "Kinh Tế Vĩ Mô & Vi Mô", "Tài Chính Doanh Nghiệp",
                "Marketing Digital", "Quản Trị Nhân Sự", "Luật Kinh Tế & Pháp Luật", "Tâm Lý Học Học Đường",
                "Kinh Nghiệm Phỏng Vấn Công Ty", "Góc Tự Học & Quản Lý Thời Gian", "Luyện Thi SAT & ACT",
                "Kỹ Thuật Điện Điện Tử", "Kiến Trúc & Xây Dựng", "Ngoại Ngữ - Tiếng Nhật", "Ngoại Ngữ - Tiếng Anh",
                "Văn Học & Nghệ Thuật", "Âm Nhạc & Cảm Âm", "Thể Thao & Sức Khỏe Học Đường", "Kỹ Năng Quản Lý Tài Chính",
                "Khởi Nghiệp & Startup Student", "Triết Học & Tư Duy Phản Biện", "Chế Tạo Robot & IoT", "DevOps & Cloud Computing", "Game Development"
            ]
            for cname in new_cat_list:
                if cname not in cat_names and len(cat_ids) < 55:
                    c_id = uuid.uuid4()
                    await conn.execute(text("""
                        INSERT INTO forum_categories (id, name, description)
                        VALUES (:id, :name, :desc)
                        ON CONFLICT (name) DO NOTHING;
                    """), {"id": c_id, "name": cname, "desc": f"Thảo luận về {cname}"})
                    cat_ids.append(c_id)

        # 13. Forum Posts, Tags, Post Tags, Comments, Post/Comment Reactions (Target: 105+ posts, 52+ tags, 80+ post_tags, 220+ comments, 130+ comment_reactions, 160+ post_reactions)
        res = await conn.execute(text("SELECT id FROM forum_posts;"))
        existing_posts = res.fetchall()
        post_ids = [r[0] for r in existing_posts]
        needed_posts = max(0, 105 - len(post_ids))
        if needed_posts > 0:
            print(f"Creating {needed_posts} forum posts...")
            post_titles = [
                "Bí quyết tự học Python cho người mới bắt đầu từ số 0",
                "Kinh nghiệm đạt IELTS 8.0 Overall trong 6 tháng tự học",
                "Giải thích chi tiết về thuật toán Dijkstra và ứng dụng",
                "Làm sao để duy trì thói quen thức dậy sớm 5:00 AM học bài?",
                "Tổng hợp 100 câu hỏi trắc nghiệm Toán THPTQG hay có đáp án",
                "Sự khác biệt giữa SQL và NoSQL: Khi nào nên dùng loại nào?",
                "Kinh nghiệm săn học bổng toàn phần du học Nhật Bản MEXT",
                "Chia sẻ bộ tài liệu tự học Tiếng Trung HSK 5 miễn phí",
                "Cách viết CV chuẩn ATS gây ấn tượng mạnh với nhà tuyển dụng",
                "Tìm hiểu kiến trúc Microservices và gRPC trong Go"
            ]
            for i in range(needed_posts):
                p_id = uuid.uuid4()
                author_id = random.choice(profile_ids)
                c_id = random.choice(cat_ids)
                title = random.choice(post_titles)
                await conn.execute(text("""
                    INSERT INTO forum_posts (id, author_id, category_id, title, content)
                    VALUES (:id, :a_id, :c_id, :title, :content);
                """), {
                    "id": p_id,
                    "a_id": author_id,
                    "c_id": c_id,
                    "title": f"{title} #{i+1}",
                    "content": f"Bài viết chi tiết về chủ đề {title}. Rất mong nhận được phản hồi và trao đổi từ mọi người!"
                })
                post_ids.append(p_id)

        # Tags & Post Tags (Target: 52+ tags, 80+ post_tags)
        res = await conn.execute(text("SELECT id, name FROM tags;"))
        existing_tags = res.fetchall()
        tag_ids = [r[0] for r in existing_tags]
        tag_names = set([r[1] for r in existing_tags])
        
        needed_tags = max(0, 52 - len(tag_ids))
        if needed_tags > 0:
            print(f"Creating {needed_tags} tags...")
            new_tag_names = [
                "python", "fastapi", "react", "ielts", "pomodoro", "ai", "data-structures", "leetcode", "study-tips", "scholarship",
                "ui-ux", "math", "physics", "tiengtrung", "n2-jlpt", "flutter", "cybersecurity", "career", "interview", "productivity",
                "chatgpt", "sql", "docker", "git", "writing", "speaking", "toeic", "gpa", "sat", "devops", "cloud", "aws", "golang", "cplusplus", "webdev"
            ]
            for tname in new_tag_names:
                if tname not in tag_names and len(tag_ids) < 55:
                    t_id = uuid.uuid4()
                    await conn.execute(text("""
                        INSERT INTO tags (id, name)
                        VALUES (:id, :name)
                        ON CONFLICT (name) DO NOTHING;
                    """), {"id": t_id, "name": tname})
                    tag_ids.append(t_id)

        res = await conn.execute(text("SELECT COUNT(*) FROM post_tags;"))
        curr_pt = res.scalar()
        needed_pt = max(0, 80 - curr_pt)
        if needed_pt > 0:
            print(f"Creating {needed_pt} post tags...")
            for i in range(needed_pt):
                p_id = random.choice(post_ids)
                t_id = random.choice(tag_ids)
                await conn.execute(text("""
                    INSERT INTO post_tags (post_id, tag_id)
                    VALUES (:p_id, :t_id)
                    ON CONFLICT (post_id, tag_id) DO NOTHING;
                """), {"p_id": p_id, "t_id": t_id})

        # Comments (Target: 220+)
        res = await conn.execute(text("SELECT id FROM comments;"))
        existing_cmts = res.fetchall()
        cmt_ids = [r[0] for r in existing_cmts]
        needed_cmts = max(0, 220 - len(cmt_ids))
        if needed_cmts > 0:
            print(f"Creating {needed_cmts} comments...")
            cmt_texts = [
                "Bài viết rất hữu ích, cảm ơn tác giả đã chia sẻ!",
                "Cho mình hỏi thêm về phần ví dụ được không ạ?",
                "Mình cũng đang áp dụng phương pháp này và thấy hiệu quả rõ rệt.",
                "Tài liệu tuyệt vời, đúng thứ mình đang tìm kiếm!",
                "Đồng ý với quan điểm của bạn, bài viết rất sâu sắc."
            ]
            for i in range(needed_cmts):
                c_id = uuid.uuid4()
                p_id = random.choice(post_ids)
                a_id = random.choice(profile_ids)
                parent_id = random.choice(cmt_ids) if (cmt_ids and random.random() < 0.3) else None
                await conn.execute(text("""
                    INSERT INTO comments (id, post_id, author_id, parent_comment_id, content)
                    VALUES (:id, :p_id, :a_id, :parent_id, :content);
                """), {"id": c_id, "p_id": p_id, "a_id": a_id, "parent_id": parent_id, "content": random.choice(cmt_texts)})
                cmt_ids.append(c_id)

        # Comment Reactions (Target: 130+)
        res = await conn.execute(text("SELECT COUNT(*) FROM comment_reactions;"))
        curr_cr = res.scalar()
        needed_cr = max(0, 130 - curr_cr)
        if needed_cr > 0 and cmt_ids:
            print(f"Creating {needed_cr} comment reactions...")
            emojis = ["👍", "❤️", "😆", "😮", "😢", "😡"]
            for i in range(needed_cr):
                c_id = random.choice(cmt_ids)
                u_id = random.choice(profile_ids)
                await conn.execute(text("""
                    INSERT INTO comment_reactions (comment_id, user_id, emoji)
                    VALUES (:c_id, :u_id, :emoji)
                    ON CONFLICT (comment_id, user_id) DO NOTHING;
                """), {"c_id": c_id, "u_id": u_id, "emoji": random.choice(emojis)})

        # Post Reactions (Target: 160+)
        res = await conn.execute(text("SELECT COUNT(*) FROM post_reactions;"))
        curr_pr = res.scalar()
        needed_pr = max(0, 160 - curr_pr)
        if needed_pr > 0 and post_ids:
            print(f"Creating {needed_pr} post reactions...")
            emojis = ["👍", "❤️", "😆", "😮", "😢", "😡"]
            for i in range(needed_pr):
                p_id = random.choice(post_ids)
                u_id = random.choice(profile_ids)
                await conn.execute(text("""
                    INSERT INTO post_reactions (post_id, user_id, emoji)
                    VALUES (:p_id, :u_id, :emoji)
                    ON CONFLICT (post_id, user_id) DO NOTHING;
                """), {"p_id": p_id, "u_id": u_id, "emoji": random.choice(emojis)})

        # 14. User Bans, Forum Moderation Actions, User Reports (Target: 52+ bans, 56+ mod actions, 52+ reports)
        res = await conn.execute(text("SELECT COUNT(*) FROM user_bans;"))
        curr_bans = res.scalar()
        needed_bans = max(0, 52 - curr_bans)
        if needed_bans > 0:
            print(f"Creating {needed_bans} user bans...")
            ban_types = ["post", "message", "create_group", "join_group", "join_room"]
            ban_reasons = [
                "Quảng cáo rác (Spam link ngoài).",
                "Sử dụng ngôn từ không phù hợp trong forum.",
                "Spam tin nhắn hàng loạt trong phòng tự học.",
                "Đăng bài viết sai quy định cộng đồng."
            ]
            for i in range(needed_bans):
                u_id = random.choice(profile_ids)
                creator_id = random.choice(profile_ids)
                await conn.execute(text("""
                    INSERT INTO user_bans (user_id, ban_type, reason, created_by)
                    VALUES (:u_id, CAST(:btype AS ban_type), :reason, :creator);
                """), {"u_id": u_id, "btype": random.choice(ban_types), "reason": random.choice(ban_reasons), "creator": creator_id})

        res = await conn.execute(text("SELECT COUNT(*) FROM forum_moderation_actions;"))
        curr_fma = res.scalar()
        needed_fma = max(0, 56 - curr_fma)
        if needed_fma > 0:
            print(f"Creating {needed_fma} forum moderation actions...")
            fma_types = ["delete_post", "delete_comment", "ban_user", "unban_user", "grant_moderator", "revoke_moderator"]
            fma_reasons = [
                "Xóa bài viết do trùng lặp thông tin.",
                "Xóa bình luận chứa từ ngữ không văn minh.",
                "Khóa tài khoản vi phạm tiêu chuẩn cộng đồng.",
                "Cấp quyền Moderator cho thành viên tích cực."
            ]
            for i in range(needed_fma):
                mod_id = random.choice(profile_ids)
                target_user = random.choice(profile_ids)
                target_id = random.choice(post_ids) if post_ids else None
                await conn.execute(text("""
                    INSERT INTO forum_moderation_actions (moderator_id, action, target_user_id, target_id, reason)
                    VALUES (:m_id, CAST(:action AS forum_moderation_action_type), :t_user, :t_id, :reason);
                """), {"m_id": mod_id, "action": random.choice(fma_types), "t_user": target_user, "t_id": target_id, "reason": random.choice(fma_reasons)})

        res = await conn.execute(text("SELECT COUNT(*) FROM user_reports;"))
        curr_ur = res.scalar()
        needed_ur = max(0, 52 - curr_ur)
        if needed_ur > 0:
            print(f"Creating {needed_ur} user reports...")
            reasons = ["spam", "harassment", "inappropriate_content", "impersonation", "other"]
            statuses = ["pending", "resolved", "dismissed"]
            descriptions = [
                "Người dùng gửi quá nhiều tin nhắn rác.",
                "Có hành vi xúc phạm thành viên khác trong phòng học.",
                "Đăng nội dung không lành mạnh trên forum.",
                "Giả mạo tài khoản giảng viên."
            ]
            for i in range(needed_ur):
                pair = random.sample(profile_ids, 2)
                rep_id, target_id = pair[0], pair[1]
                st = random.choice(statuses)
                res_by = random.choice(profile_ids) if st != "pending" else None
                res_at = datetime.now() if st != "pending" else None
                await conn.execute(text("""
                    INSERT INTO user_reports (reporter_id, reported_user_id, reason, description, status, resolved_by, resolved_at)
                    VALUES (:r_id, :t_id, CAST(:reason AS report_reason), :desc, CAST(:st AS report_status), :res_by, :res_at);
                """), {
                    "r_id": rep_id,
                    "t_id": target_id,
                    "reason": random.choice(reasons),
                    "desc": random.choice(descriptions),
                    "st": st,
                    "res_by": res_by,
                    "res_at": res_at
                })

        # 15. Notifications (Target: 310+)
        res = await conn.execute(text("SELECT COUNT(*) FROM notifications;"))
        curr_notif = res.scalar()
        needed_notif = max(0, 310 - curr_notif)
        if needed_notif > 0:
            print(f"Creating {needed_notif} notifications...")
            notif_types = [
                "post_like", "post_comment", "comment_reply", "group_invite", "group_role_changed",
                "room_kicked", "mention", "study_room_invitation", "private_channel_invitation",
                "task_daily_reminder", "task_due_soon", "group_new_resource", "new_direct_message", "message_group"
            ]
            for i in range(needed_notif):
                u_id = random.choice(profile_ids)
                actor_id = random.choice(profile_ids)
                ntype = random.choice(notif_types)
                p_id = random.choice(post_ids) if post_ids and random.random() < 0.4 else None
                g_id = random.choice(group_ids) if group_ids and random.random() < 0.4 else None
                await conn.execute(text("""
                    INSERT INTO notifications (user_id, actor_id, type, post_id, group_id, is_read)
                    VALUES (:u_id, :actor_id, CAST(:ntype AS notification_type), :p_id, :g_id, :is_read);
                """), {
                    "u_id": u_id,
                    "actor_id": actor_id,
                    "ntype": ntype,
                    "p_id": p_id,
                    "g_id": g_id,
                    "is_read": random.choice([True, False])
                })

        print("--- SEEDING COMPLETED SUCCESSFULLY ---")

if __name__ == "__main__":
    asyncio.run(seed())
