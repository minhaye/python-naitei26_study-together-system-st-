import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_current_user_optional, require_forum_moderator
from app.auth.dto.auth_dto import CurrentUser
from app.core.dto.pagination_dto import PaginatedResponse
from app.core.permissions import get_active_ban, is_forum_moderator
from app.db.enums import BanType, ForumModerationActionType
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
from app.moderation.services.moderation_service import ModerationService

router = APIRouter(prefix="/forum", tags=["Forum"])
service = ForumService()
moderation_service = ModerationService()


async def _ensure_not_post_banned(session: AsyncSession, user_id: uuid.UUID) -> None:
    ban = await get_active_ban(session, user_id, BanType.POST)
    if ban:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            ModerationService.format_ban_message(ban, "đăng bài và bình luận trong diễn đàn"),
        )


# --- Categories ---
# Structural data -- only Moderators/Admins may create/edit/delete a category.


@router.post("/categories", response_model=ForumCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: ForumCategoryCreate,
    _current_user: CurrentUser = Depends(require_forum_moderator),
    session: AsyncSession = Depends(get_db_session),
):
    """Create a new forum category. Requires forum moderator role."""
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
    """List all forum categories."""
    return await service.list_categories(session)


@router.get("/categories/{category_id}", response_model=ForumCategoryResponse)
async def get_category(category_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    """Get a single forum category by its ID."""
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
    _current_user: CurrentUser = Depends(require_forum_moderator),
    session: AsyncSession = Depends(get_db_session)
):
    """Update an existing forum category. Requires forum moderator role."""
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
async def delete_category(
    category_id: uuid.UUID,
    _current_user: CurrentUser = Depends(require_forum_moderator),
    session: AsyncSession = Depends(get_db_session),
):
    """Delete a forum category. Requires forum moderator role."""
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
async def create_post(
    data: ForumPostCreate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Create a new forum post. Requires authentication; users with an active post ban are rejected."""
    await _ensure_not_post_banned(session, current_user.id)
    try:
        post = await service.create_post(session, data, author_id=current_user.id)
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
    current_user: CurrentUser | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_db_session)
):
    """Get a single forum post by its ID. Authentication is optional; if provided, the response reflects the current user's reactions."""
    post = await service.get_post_by_id(session, post_id, user_id=current_user.id if current_user else None)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    return post


@router.get("/posts", response_model=PaginatedResponse[ForumPostResponse])
async def list_posts(
    category_id: uuid.UUID | None = None,
    author_id: uuid.UUID | None = None,
    tag: str | None = None,
    skip: int = 0,
    limit: int = 50,
    current_user: CurrentUser | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_db_session)
):
    """List forum posts, optionally filtered by category, author, or tag. Supports pagination via `skip`/`limit` (default limit 50)."""
    posts, total = await service.list_posts_by_category(
        session, category_id, tag=tag, author_id=author_id, user_id=current_user.id if current_user else None, skip=skip, limit=limit
    )
    return PaginatedResponse(items=posts, total=total)


# --- Tags ---


@router.get("/tags/trending", response_model=list[TagResponse])
async def get_trending_tags(limit: int = 5, session: AsyncSession = Depends(get_db_session)):
    """Get the most popular forum tags, ordered by usage."""
    return await service.get_trending_tags(session, limit=limit)


@router.get("/tags/search", response_model=list[TagResponse])
async def search_tags(q: str = "", limit: int = 10, session: AsyncSession = Depends(get_db_session)):
    """Search forum tags by name prefix/substring."""
    return await service.search_tags(session, query=q, limit=limit)


@router.put("/posts/{post_id}", response_model=ForumPostResponse)
async def update_post(
    post_id: uuid.UUID,
    data: ForumPostUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    """Update a forum post. Only the original author may edit their own post."""
    post = await service.get_post_by_id(session, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    if post.author_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the author can edit this post")
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
async def delete_post(
    post_id: uuid.UUID,
    reason: str | None = None,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Soft-delete a forum post. The author may delete their own post; moderators may delete any post, which is logged as a moderation action with an optional `reason`."""
    post = await service.get_post_by_id(session, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    is_author = post.author_id == current_user.id
    if not is_author and not await is_forum_moderator(session, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to delete this post")
    try:
        if not is_author:
            await moderation_service.log_action(
                session,
                moderator_id=current_user.id,
                action=ForumModerationActionType.DELETE_POST,
                target_user_id=post.author_id,
                target_id=post.id,
                reason=reason,
            )
        updated = await service.soft_delete_post(
            session, post, deleted_by=current_user.id if not is_author else None
        )
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
async def create_comment(
    data: CommentCreate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Create a new comment on a forum post. Requires authentication; users with an active post ban are rejected."""
    await _ensure_not_post_banned(session, current_user.id)
    try:
        comment = await service.create_comment(session, data, author_id=current_user.id)
        await session.commit()
        return comment
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not create comment: {str(e)}"
        )


@router.get("/comments/{comment_id}", response_model=CommentResponse)
async def get_comment(
    comment_id: uuid.UUID,
    current_user: CurrentUser | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_db_session),
):
    """Get a single comment by its ID. Authentication is optional; if provided, the response reflects the current user's reactions."""
    comment = await service.get_comment_by_id(session, comment_id, user_id=current_user.id if current_user else None)
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    return comment


@router.get("/comments", response_model=list[CommentResponse])
async def list_comments(
    post_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
    current_user: CurrentUser | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_db_session)
):
    """List comments on a forum post. Supports pagination via `skip`/`limit` (default limit 50)."""
    return await service.list_comments_by_post(
        session, post_id, user_id=current_user.id if current_user else None, skip=skip, limit=limit
    )


@router.put("/comments/{comment_id}", response_model=CommentResponse)
async def update_comment(
    comment_id: uuid.UUID,
    data: CommentUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    """Update a comment. Only the original author may edit their own comment."""
    comment = await service.get_comment_by_id(session, comment_id)
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    if comment.author_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the author can edit this comment")
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
async def delete_comment(
    comment_id: uuid.UUID,
    reason: str | None = None,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Delete a comment. The author may delete their own comment; moderators may delete any comment, which is logged as a moderation action with an optional `reason`."""
    comment = await service.get_comment_by_id(session, comment_id)
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    is_author = comment.author_id == current_user.id
    if not is_author and not await is_forum_moderator(session, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to delete this comment")
    try:
        if not is_author:
            await moderation_service.log_action(
                session,
                moderator_id=current_user.id,
                action=ForumModerationActionType.DELETE_COMMENT,
                target_user_id=comment.author_id,
                target_id=comment.id,
                reason=reason,
            )
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
    """List forum posts that a given user has reacted to. Supports pagination via `skip`/`limit` (default limit 50)."""
    return await service.list_reacted_posts(session, user_id, skip=skip, limit=limit)


@router.put("/posts/{post_id}/reactions", response_model=list[ReactionSummary])
async def set_post_reaction(
    post_id: uuid.UUID,
    data: ReactionSet,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    """Set (or replace) the current user's emoji reaction on a post. Requires authentication and returns the updated reaction summary."""
    post = await service.get_post_by_id(session, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    try:
        await service.set_post_reaction(session, post_id, current_user.id, data.emoji)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not set reaction: {str(e)}"
        )
    return await service.get_post_reactions(session, post_id, current_user.id)


@router.delete("/posts/{post_id}/reactions", response_model=list[ReactionSummary])
async def remove_post_reaction(
    post_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    """Remove the current user's emoji reaction from a post. Requires authentication and returns the updated reaction summary."""
    try:
        await service.remove_post_reaction(session, post_id, current_user.id)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not remove reaction: {str(e)}"
        )
    return await service.get_post_reactions(session, post_id, current_user.id)


@router.get("/posts/{post_id}/reactions", response_model=list[ReactionSummary])
async def get_post_reactions(
    post_id: uuid.UUID,
    current_user: CurrentUser | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_db_session)
):
    """Get the emoji reaction summary for a post. Authentication is optional; if provided, indicates the current user's own reaction."""
    return await service.get_post_reactions(session, post_id, current_user.id if current_user else None)


@router.put("/comments/{comment_id}/reactions", response_model=list[ReactionSummary])
async def set_comment_reaction(
    comment_id: uuid.UUID,
    data: ReactionSet,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    """Set (or replace) the current user's emoji reaction on a comment. Requires authentication and returns the updated reaction summary."""
    comment = await service.get_comment_by_id(session, comment_id)
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    try:
        await service.set_comment_reaction(session, comment_id, current_user.id, data.emoji)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not set reaction: {str(e)}"
        )
    return await service.get_comment_reactions(session, comment_id, current_user.id)


@router.delete("/comments/{comment_id}/reactions", response_model=list[ReactionSummary])
async def remove_comment_reaction(
    comment_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    """Remove the current user's emoji reaction from a comment. Requires authentication and returns the updated reaction summary."""
    try:
        await service.remove_comment_reaction(session, comment_id, current_user.id)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not remove reaction: {str(e)}"
        )
    return await service.get_comment_reactions(session, comment_id, current_user.id)


@router.get("/comments/{comment_id}/reactions", response_model=list[ReactionSummary])
async def get_comment_reactions(
    comment_id: uuid.UUID,
    current_user: CurrentUser | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_db_session)
):
    """Get the emoji reaction summary for a comment. Authentication is optional; if provided, indicates the current user's own reaction."""
    return await service.get_comment_reactions(session, comment_id, current_user.id if current_user else None)
