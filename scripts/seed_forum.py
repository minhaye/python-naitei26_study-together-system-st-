import asyncio
import sys

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uuid
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

from app.db.base import Base
# Import all entities to ensure they are registered with Base
from app.forum.entities.forum_entity import ForumCategory, ForumPost, Comment, CommentLike, PostLike
from app.profiles.entities.profile_entity import Profile

DATABASE_URL = "postgresql+psycopg://postgres.rncoptajwdtueqvtbgkw:StYWBhaleE0wcssN@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"

async def main():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    
    async with engine.begin() as conn:
        # Create tables
        await conn.run_sync(Base.metadata.create_all)
        print("Tables verified/created.")
        
    async with async_session() as session:
        # Check if profiles exist
        result = await session.execute(text("SELECT id FROM profiles LIMIT 1"))
        has_profiles = result.scalar() is not None
        
        if not has_profiles:
            print("Creating mock profiles...")
            # Create some mock users
            user1_id = str(uuid.uuid4())
            user2_id = str(uuid.uuid4())
            user3_id = str(uuid.uuid4())
            await session.execute(text(f"INSERT INTO profiles (id, full_name, email) VALUES ('{user1_id}', 'Hải Minh', 'hai@example.com')"))
            await session.execute(text(f"INSERT INTO profiles (id, full_name, email) VALUES ('{user2_id}', 'Tuấn Tú', 'tuan@example.com')"))
            await session.execute(text(f"INSERT INTO profiles (id, full_name, email) VALUES ('{user3_id}', 'Ngọc Anh', 'ngoc@example.com')"))
        else:
            print("Profiles exist, getting their IDs...")
            res = await session.execute(text("SELECT id FROM profiles LIMIT 3"))
            profiles = res.scalars().all()
            user1_id = profiles[0]
            user2_id = profiles[1] if len(profiles) > 1 else profiles[0]
            user3_id = profiles[2] if len(profiles) > 2 else profiles[0]

        # Check if categories exist
        res_cat = await session.execute(text("SELECT count(*) FROM forum_categories"))
        cat_count = res_cat.scalar()
        
        if cat_count == 0:
            print("Creating mock categories...")
            cats = [
                ("Ngoại ngữ", "ngoai-ngu"),
                ("Công nghệ thông tin", "cntt"),
                ("Toán học", "toan-hoc"),
                ("Trung học Phổ thông (THPT)", "thpt"),
                ("Kinh tế & Tài chính", "kinh-te-tai-chinh"),
                ("Y khoa & Dược học", "y-khoa-duoc-hoc"),
                ("Luật học", "luat-hoc"),
                ("Giáo dục & Sư phạm", "giao-duc-su-pham"),
            ]
            for name, _ in cats:
                cat_id = str(uuid.uuid4())
                await session.execute(text("INSERT INTO forum_categories (id, name, description) VALUES (:id, :name, :desc)"), {"id": cat_id, "name": name, "desc": "Mô tả cho " + name})
                
            await session.commit()
            
            # Re-fetch a category to insert post
            res_cat = await session.execute(text("SELECT id, name FROM forum_categories LIMIT 2"))
            cat1, cat2 = res_cat.all()
            
            print("Creating mock posts...")
            post_id = str(uuid.uuid4())
            await session.execute(text("""
                INSERT INTO forum_posts (id, author_id, category_id, title, content) 
                VALUES (:id, :author_id, :category_id, :title, :content)
            """), {
                "id": post_id,
                "author_id": user1_id,
                "category_id": cat1.id,
                "title": f"Câu hỏi về {cat1.name}",
                "content": "Làm thế nào để học tốt môn này? Mọi người chia sẻ bí quyết với ạ."
            })
            
            print("Creating mock comments...")
            cmt_id = str(uuid.uuid4())
            await session.execute(text("""
                INSERT INTO comments (id, post_id, author_id, content) 
                VALUES (:id, :post_id, :author_id, :content)
            """), {
                "id": cmt_id,
                "post_id": post_id,
                "author_id": user2_id,
                "content": "Bạn nên bắt đầu bằng việc đọc kỹ lý thuyết nhé!"
            })
            
            await session.commit()
            print("Seed complete.")
        else:
            print("Categories already seeded.")

if __name__ == '__main__':
    asyncio.run(main())
