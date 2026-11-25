<?php
/**
 * Plugin Name: Local SEO Workbench Repairs
 * Description: Preview, apply and restore explicitly selected title, description and attachment-alt drafts from a local audit.
 * Version: 0.1.0
 * License: GPL-2.0-or-later
 */
if (!defined('ABSPATH')) exit;
add_filter('pre_get_document_title', function ($title) {
    if (!is_singular()) return $title;
    $value = get_post_meta(get_queried_object_id(), '_lsw_title', true);
    return $value !== '' ? $value : $title;
}, 99999);
add_action('wp_head', function () {
    if (!is_singular()) return;
    $value = get_post_meta(get_queried_object_id(), '_lsw_description', true);
    if ($value !== '') echo '<meta name="description" content="' . esc_attr($value) . '" />' . "\n";
}, 1);
add_action('admin_menu', function () { add_management_page('SEO repair plans', 'SEO repair plans', 'manage_options', 'lsw-repairs', 'lsw_admin'); });
function lsw_origin($url) { $p = wp_parse_url($url); return strtolower(($p['scheme'] ?? '') . '://' . ($p['host'] ?? '') . (isset($p['port']) ? ':' . $p['port'] : '')); }
function lsw_value($repair) {
    if ($repair['field'] === 'alt_text') return (string) get_post_meta($repair['post_id'], '_wp_attachment_image_alt', true);
    $response = wp_remote_get($repair['url'], array('timeout' => 12, 'redirection' => 0, 'headers' => array('Cache-Control' => 'no-cache')));
    if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) throw new Exception('Could not verify current public HTML. No change applied.');
    $html = wp_remote_retrieve_body($response);
    if ($repair['field'] === 'title') {
        preg_match('/<title\b[^>]*>(.*?)<\/title>/is', $html, $m);
        return trim(html_entity_decode(wp_strip_all_tags($m[1] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    }
    $dom = new DOMDocument(); $previous = libxml_use_internal_errors(true); $dom->loadHTML('<?xml encoding="utf-8" ?>' . $html); libxml_clear_errors(); libxml_use_internal_errors($previous);
    $values = array();
    foreach ($dom->getElementsByTagName('meta') as $meta) if (strtolower($meta->getAttribute('name')) === 'description') $values[] = $meta->getAttribute('content');
    if (count($values) > 1) throw new Exception('Multiple description tags already exist. Resolve them in your SEO plugin first.');
    return trim($values[0] ?? '');
}
function lsw_prepare($input) {
    if (($input['schema'] ?? '') !== 'local-seo-plan/v1' || lsw_origin($input['site'] ?? '') !== lsw_origin(home_url())) throw new Exception('This plan does not match this website.');
    if (!is_array($input['repairs'] ?? null) || count($input['repairs']) > 200) throw new Exception('Invalid plan or more than 200 drafts.');
    $prepared = array(); $seen = array();
    foreach ($input['repairs'] as $row) {
        $field = $row['field'] ?? ''; $url = esc_url_raw($row['url'] ?? '');
        if (!in_array($field, array('title','meta_description','alt_text'), true) || lsw_origin($url) !== lsw_origin(home_url())) throw new Exception('Unsupported field or page outside this site.');
        $value = sanitize_text_field($row['value'] ?? ''); if ($value === '' || strlen($value) > 2000) throw new Exception('Replacement text is empty or too long.');
        $id = $field === 'alt_text' ? attachment_url_to_postid(esc_url_raw($row['imageSrc'] ?? '')) : url_to_postid($url);
        if (!$id || !current_user_can('edit_post', $id)) throw new Exception('Could not resolve or edit a selected post/attachment. Archives and external images are unsupported.');
        $identity = $id . ':' . $field; if (isset($seen[$identity])) throw new Exception('The plan includes more than one draft for the same post field or shared attachment. Keep one draft.'); $seen[$identity] = true;
        $key = $field === 'title' ? '_lsw_title' : ($field === 'meta_description' ? '_lsw_description' : '_wp_attachment_image_alt');
        $repair = array('url'=>$url,'field'=>$field,'post_id'=>$id,'key'=>$key,'value'=>$value,'original'=>trim((string)($row['original'] ?? '')));
        $current = lsw_value($repair);
        if ($current !== $repair['original']) throw new Exception('The current value differs from the scan at ' . $url . '. Rescan before applying this plan.');
        // A separate description plugin would produce duplicate tags with our renderer.
        if ($field === 'meta_description' && $current !== '' && get_post_meta($id, '_lsw_description', true) === '') throw new Exception('An existing description is owned elsewhere. Edit it in your current SEO plugin; this importer only adds a missing description or updates its own override.');
        $repair['before'] = get_post_meta($id, $key, true); $repair['existed'] = metadata_exists('post', $id, $key); $prepared[] = $repair;
    }
    if (!$prepared) throw new Exception('The plan has no drafts.'); return $prepared;
}
function lsw_admin() {
    if (!current_user_can('manage_options')) return;
    $message = ''; $error = ''; $preview = null;
    try {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            check_admin_referer('lsw-repairs'); $action = sanitize_key($_POST['lsw_action'] ?? '');
            if ($action === 'preview') {
                if (empty($_FILES['plan']['tmp_name']) || $_FILES['plan']['size'] > 1000000 || $_FILES['plan']['error'] !== UPLOAD_ERR_OK) throw new Exception('Upload a JSON plan under 1 MB.');
                $input = json_decode(file_get_contents($_FILES['plan']['tmp_name']), true); if (!is_array($input)) throw new Exception('Invalid JSON.');
                $preview = lsw_prepare($input); set_transient('lsw_preview_' . get_current_user_id(), $preview, 15 * MINUTE_IN_SECONDS);
            } elseif ($action === 'apply') {
                $rows = get_transient('lsw_preview_' . get_current_user_id()); if (!$rows) throw new Exception('Preview expired. Import the plan again.');
                foreach ($rows as $row) {
                    if (!current_user_can('edit_post', $row['post_id']) || lsw_value($row) !== $row['original'] || get_post_meta($row['post_id'], $row['key'], true) !== $row['before']) throw new Exception('A selected value changed since preview. No plan applied.');
                }
                $history = get_option('lsw_history', array()); $batch = wp_generate_uuid4(); $applied = array();
                $history[$batch] = array('at'=>current_time('mysql'),'rows'=>array()); update_option('lsw_history', $history, false);
                foreach ($rows as $row) {
                    // Keep the original before writing, so an interrupted request retains recovery data.
                    $history[$batch]['rows'][] = $row; update_option('lsw_history', $history, false);
                    update_post_meta($row['post_id'], $row['key'], $row['value']); clean_post_cache($row['post_id']);
                    if ((string)get_post_meta($row['post_id'], $row['key'], true) !== $row['value']) { $error = 'Some writes failed. Applied items are recorded for restoration.'; break; }
                    $applied[] = $row;
                }
                // A failed/interrupted write may retain a pending row. Restore checks each current value.
                delete_transient('lsw_preview_' . get_current_user_id()); $message = count($applied) . ' fields stored. Clear your page cache and verify the public HTML. Storage success does not mean search indexing.';
            } elseif ($action === 'restore') {
                $history = get_option('lsw_history', array()); $batch = sanitize_text_field($_POST['batch'] ?? ''); $entry = $history[$batch] ?? null;
                if (!$entry || !empty($entry['restored'])) throw new Exception('No restorable batch.');
                foreach ($entry['rows'] as $row) if (!current_user_can('edit_post', $row['post_id']) || !in_array((string)get_post_meta($row['post_id'], $row['key'], true), array((string)$row['value'],(string)$row['before']), true)) throw new Exception('A value changed after application. Restoration stopped to preserve the newer edit.');
                foreach ($entry['rows'] as $row) {
                    if ($row['existed']) update_post_meta($row['post_id'], $row['key'], $row['before']); else delete_post_meta($row['post_id'], $row['key']);
                    clean_post_cache($row['post_id']);
                    if ((string)get_post_meta($row['post_id'], $row['key'], true) !== (string)$row['before'] || (!$row['existed'] && metadata_exists('post',$row['post_id'],$row['key']))) throw new Exception('A restore write could not be confirmed. This batch remains available for recovery.');
                }
                $history[$batch]['restored'] = current_time('mysql'); update_option('lsw_history',$history,false); $message='Stored fields restored. Clear page caches and check the live output.';
            }
        }
    } catch (Throwable $e) { $error = $e->getMessage(); }
    echo '<div class="wrap"><h1>Local SEO repair plans</h1><p>Import a reviewed plan. Nothing is applied until you preview and confirm.</p>';
    if ($message) echo '<div class="notice notice-success"><p>'.esc_html($message).'</p></div>';
    if ($error) echo '<div class="notice notice-error"><p>'.esc_html($error).'</p></div>';
    echo '<p>Supports title overrides, missing descriptions, and attachment alt text. Shared attachment alt affects every usage. H1, body text, links, archives and existing descriptions owned by other SEO plugins require manual editing. Never deactivate this plugin to undo writes; use Restore.</p><form method="post" enctype="multipart/form-data">'; wp_nonce_field('lsw-repairs'); echo '<input type="hidden" name="lsw_action" value="preview"><input required type="file" name="plan" accept=".json,application/json"><button class="button">Import and preview</button></form>';
    if ($preview) {
        echo '<h2>Confirm the changes</h2><table class="widefat striped"><tr><th>Field / page</th><th>Current</th><th>Replacement</th></tr>';
        foreach ($preview as $r) echo '<tr><td>'.esc_html($r['field'].' — '.$r['url']).'</td><td>'.esc_html($r['original']).'</td><td>'.esc_html($r['value']).'</td></tr>';
        echo '</table><form method="post">';wp_nonce_field('lsw-repairs');echo '<input type="hidden" name="lsw_action" value="apply"><p><label><input required type="checkbox"> I reviewed these changes and understand they alter this website.</label></p><button class="button button-primary">Apply reviewed plan</button></form>';
    }
    echo '<h2>Applied batches</h2>';
    foreach (array_reverse(get_option('lsw_history',array()),true) as $batch=>$entry) {
        echo '<div style="margin:15px 0"><strong>'.esc_html($entry['at']).'</strong> — '.count($entry['rows']).' fields';
        if (!empty($entry['restored'])) echo ' — restored '.esc_html($entry['restored']); else {echo '<form method="post" style="display:inline;margin-left:15px">';wp_nonce_field('lsw-repairs');echo '<input type="hidden" name="lsw_action" value="restore"><input type="hidden" name="batch" value="'.esc_attr($batch).'"><button class="button">Restore this batch</button></form>';}
        echo '</div>';
    }
    echo '</div>';
}
