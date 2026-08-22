import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.forum.dto.forum_dto import (
    CommentCreate,
    CommentResponse,
    CommentUpdate,
    ForumCategoryCreate,
    ForumCategoryResponse,
    ForumCategoryUpdate,
    ForumPostCreate,
    ForumPostResponse,
    ForumPostUpdate,
    ReactionSet,
    ReactionSummary,
    TagResponse,
)
from app.forum.services.forum_service import ForumService

router = APIRouter(prefix="/forum", tags=["Forum"])
service = ForumService()


# --- Categories ---


@router.post("/categories", response_model=ForumCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(data: ForumCategoryCreate, session: AsyncSession = Depends(get_db_session)):
    try:
        category = await service.create_category(session, data)
        await session.commit()
        return category
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not create category: {str(e)}"
        )


@router.get("/categories", response_model=list[ForumCategoryResponse])
async def list_categories(session: AsyncSession = Depends(get_db_session)):
    return await service.list_categories(session)

@router.get("/migrate-categories")
async def migrate_categories(session: AsyncSession = Depends(get_db_session)):
    from sqlalchemy import select, update, delete
    from app.forum.entities.forum_entity import ForumCategory, ForumPost
    new_names = [
        'Công nghệ thông tin (IT)', 'Kinh tế & Tài chính', 'Quản trị & Marketing',
        'Toán học & Toán cao cấp', 'Khoa học Tự nhiên', 'Ngoại ngữ',
        'Y khoa & Dược học', 'Luật học', 'Khoa học Xã hội & Nhân văn',
        'Triết học & Chính trị', 'Kiến trúc & Thiết kế', 'Ôn thi THPT Quốc gia-TSA-HSA',
        'Trung học Cơ sở (THCS)','Trung học Phổ Thông (THPT)', 'Sức khỏe', 'Kỹ năng mềm & Nghề nghiệp', 'Góc thư giãn', 'Hỏi đáp chung'
    ]
    res = await session.execute(select(ForumCategory))
    existing_cats = res.scalars().all()
    existing_names = {c.name: c for c in existing_cats}
    
    created_cats = {}
    for name in new_names:
        if name not in existing_names:
            cat = ForumCategory(name=name, description='')
            session.add(cat)
            created_cats[name] = cat
        else:
            created_cats[name] = existing_names[name]
    await session.flush()
    fallback_cat = created_cats['Hỏi đáp chung']
    for old_cat in existing_cats:
        if old_cat.name not in new_names:
            await session.execute(update(ForumPost).where(ForumPost.category_id == old_cat.id).values(category_id=fallback_cat.id))
            await session.execute(delete(ForumCategory).where(ForumCategory.id == old_cat.id))
    await session.commit()
    return {"message": "migrated"}


@router.get("/categories/{category_id}", response_model=ForumCategoryResponse)
async def get_category(category_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    category = await service.get_category_by_id(session, category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
    return category


@router.put("/categories/{category_id}", response_model=ForumCategoryResponse)
async def update_category(
    category_id: uuid.UUID,
    data: ForumCategoryUpdate,
    session: AsyncSession = Depends(get_db_session)
):
    category = await service.get_category_by_id(session, category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
    try:
        updated = await service.update_category(session, category, data)
        await session.commit()
        return updated
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not update category: {str(e)}"
        )


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(category_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    category = await service.get_category_by_id(session, category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
    try:
        await service.delete_category(session, category)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not delete category: {str(e)}"
        )


# --- Posts ---


@router.post("/posts", response_model=ForumPostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(data: ForumPostCreate, session: AsyncSession = Depends(get_db_session)):
    try:
        post = await service.create_post(session, data)
        await session.commit()
        return post
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not create post: {str(e)}"
        )


@router.get("/posts/{post_id}", response_model=ForumPostResponse)
async def get_post(
    post_id: uuid.UUID,
    user_id: uuid.UUID | None = None,
    session: AsyncSession = Depends(get_db_session)
):
    post = await service.get_post_by_id(session, post_id, user_id=user_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    return post


@router.get("/posts", response_model=list[ForumPostResponse])
async def list_posts(
    category_id: uuid.UUID | None = None,
    tag: str | None = None,
    user_id: uuid.UUID | None = None,
    skip: int = 0,
    limit: int = 50,
    session: AsyncSession = Depends(get_db_session)
):
    return await service.list_posts_by_category(session, category_id, tag=tag, user_id=user_id, skip=skip, limit=limit)


# --- Tags ---


@router.get("/tags/trending", response_model=list[TagResponse])
async def get_trending_tags(limit: int = 5, session: AsyncSession = Depends(get_db_session)):
    return await service.get_trending_tags(session, limit=limit)


@router.get("/tags/search", response_model=list[TagResponse])
async def search_tags(q: str = "", limit: int = 10, session: AsyncSession = Depends(get_db_session)):
    return await service.search_tags(session, query=q, limit=limit)


@router.put("/posts/{post_id}", response_model=ForumPostResponse)
async def update_post(
    post_id: uuid.UUID,
    data: ForumPostUpdate,
    session: AsyncSession = Depends(get_db_session)
):
    post = await service.get_post_by_id(session, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    try:
        updated = await service.update_post(session, post, data)
        await session.commit()
        return updated
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not update post: {str(e)}"
        )


@router.delete("/posts/{post_id}", response_model=ForumPostResponse)
async def delete_post(post_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    post = await service.get_post_by_id(session, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    try:
        # Soft delete per spec
        updated = await service.soft_delete_post(session, post)
        await session.commit()
        return updated
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not delete post: {str(e)}"
        )


# --- Comments ---


@router.post("/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment(data: CommentCreate, session: AsyncSession = Depends(get_db_session)):
    try:
        comment = await service.create_comment(session, data)
        await session.commit()
        return comment
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not create comment: {str(e)}"
        )


@router.get("/comments/{comment_id}", response_model=CommentResponse)
async def get_comment(comment_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    comment = await service.get_comment_by_id(session, comment_id)
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    return comment


@router.get("/comments", response_model=list[CommentResponse])
async def list_comments(
    post_id: uuid.UUID,
    user_id: uuid.UUID | None = None,
    session: AsyncSession = Depends(get_db_session)
):
    return await service.list_comments_by_post(session, post_id, user_id=user_id)


@router.put("/comments/{comment_id}", response_model=CommentResponse)
async def update_comment(
    comment_id: uuid.UUID,
    data: CommentUpdate,
    session: AsyncSession = Depends(get_db_session)
):
    comment = await service.get_comment_by_id(session, comment_id)
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    try:
        updated = await service.update_comment(session, comment, data)
        await session.commit()
        return updated
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not update comment: {str(e)}"
        )


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(comment_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    comment = await service.get_comment_by_id(session, comment_id)
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    try:
        await service.delete_comment(session, comment)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not delete comment: {str(e)}"
        )


# --- Reactions ---


@router.get("/users/{user_id}/liked-posts", response_model=list[ForumPostResponse])
async def list_reacted_posts(
    user_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
    session: AsyncSession = Depends(get_db_session)
):
    return await service.list_reacted_posts(session, user_id, skip=skip, limit=limit)


@router.put("/posts/{post_id}/reactions", response_model=list[ReactionSummary])
async def set_post_reaction(
    post_id: uuid.UUID,
    data: ReactionSet,
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session)
):
    post = await service.get_post_by_id(session, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    try:
        await service.set_post_reaction(session, post_id, user_id, data.emoji)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not set reaction: {str(e)}"
        )
    return await service.get_post_reactions(session, post_id, user_id)


@router.delete("/posts/{post_id}/reactions", response_model=list[ReactionSummary])
async def remove_post_reaction(
    post_id: uuid.UUID,
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session)
):
    try:
        await service.remove_post_reaction(session, post_id, user_id)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not remove reaction: {str(e)}"
        )
    return await service.get_post_reactions(session, post_id, user_id)


@router.get("/posts/{post_id}/reactions", response_model=list[ReactionSummary])
async def get_post_reactions(
    post_id: uuid.UUID,
    user_id: uuid.UUID | None = None,
    session: AsyncSession = Depends(get_db_session)
):
    return await service.get_post_reactions(session, post_id, user_id)


@router.put("/comments/{comment_id}/reactions", response_model=list[ReactionSummary])
async def set_comment_reaction(
    comment_id: uuid.UUID,
    data: ReactionSet,
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session)
):
    comment = await service.get_comment_by_id(session, comment_id)
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    try:
        await service.set_comment_reaction(session, comment_id, user_id, data.emoji)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not set reaction: {str(e)}"
        )
    return await service.get_comment_reactions(session, comment_id, user_id)


@router.delete("/comments/{comment_id}/reactions", response_model=list[ReactionSummary])
async def remove_comment_reaction(
    comment_id: uuid.UUID,
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session)
):
    try:
        await service.remove_comment_reaction(session, comment_id, user_id)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not remove reaction: {str(e)}"
        )
    return await service.get_comment_reactions(session, comment_id, user_id)


@router.get("/comments/{comment_id}/reactions", response_model=list[ReactionSummary])
async def get_comment_reactions(
    comment_id: uuid.UUID,
    user_id: uuid.UUID | None = None,
    session: AsyncSession = Depends(get_db_session)
):
    return await service.get_comment_reactions(session, comment_id, user_id)
