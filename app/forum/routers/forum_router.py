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
    PostLikeResponse,
    CommentLikeResponse,
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
async def get_post(post_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    post = await service.get_post_by_id(session, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    return post


@router.get("/posts", response_model=list[ForumPostResponse])
async def list_posts(
    category_id: uuid.UUID | None = None,
    skip: int = 0,
    limit: int = 50,
    session: AsyncSession = Depends(get_db_session)
):
    return await service.list_posts_by_category(session, category_id, skip=skip, limit=limit)


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
async def list_comments(post_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    return await service.list_comments_by_post(session, post_id)


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


# --- Likes ---


@router.get("/users/{user_id}/liked-posts", response_model=list[ForumPostResponse])
async def list_liked_posts(
    user_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
    session: AsyncSession = Depends(get_db_session)
):
    return await service.list_liked_posts(session, user_id, skip=skip, limit=limit)


@router.post("/posts/{post_id}/like", response_model=PostLikeResponse, status_code=status.HTTP_201_CREATED)
async def like_post(
    post_id: uuid.UUID,
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session)
):
    post = await service.get_post_by_id(session, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    existing = await service.get_post_like(session, post_id, user_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already liked this post"
        )
    try:
        like = await service.like_post(session, post_id, user_id)
        await session.commit()
        return like
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not like post: {str(e)}"
        )


@router.delete("/posts/{post_id}/unlike", status_code=status.HTTP_204_NO_CONTENT)
async def unlike_post(
    post_id: uuid.UUID,
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session)
):
    like = await service.get_post_like(session, post_id, user_id)
    if not like:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Like not found"
        )
    try:
        await service.unlike_post(session, like)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not unlike post: {str(e)}"
        )


@router.post("/comments/{comment_id}/like", response_model=CommentLikeResponse, status_code=status.HTTP_201_CREATED)
async def like_comment(
    comment_id: uuid.UUID,
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session)
):
    comment = await service.get_comment_by_id(session, comment_id)
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    existing = await service.get_comment_like(session, comment_id, user_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already liked this comment"
        )
    try:
        like = await service.like_comment(session, comment_id, user_id)
        await session.commit()
        return like
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not like comment: {str(e)}"
        )


@router.delete("/comments/{comment_id}/unlike", status_code=status.HTTP_204_NO_CONTENT)
async def unlike_comment(
    comment_id: uuid.UUID,
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session)
):
    like = await service.get_comment_like(session, comment_id, user_id)
    if not like:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Like not found"
        )
    try:
        await service.unlike_comment(session, like)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not unlike comment: {str(e)}"
        )
